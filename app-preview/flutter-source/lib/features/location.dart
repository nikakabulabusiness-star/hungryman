import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/backend.dart';
import '../core/ui.dart';

class LocationPage extends StatefulWidget {
  final String? shootId;
  const LocationPage({this.shootId, super.key});
  @override
  State<LocationPage> createState() => _LocationPageState();
}

class _LocationPageState extends State<LocationPage>
    with WidgetsBindingObserver {
  StreamSubscription<Position>? stream;
  DateTime? until;
  bool sharing = false;
  bool closing = false;
  String duration = '1 hour';
  bool mapsReady = false;
  Future<void> checkMaps() async {
    if (kIsWeb) return;
    if (defaultTargetPlatform != TargetPlatform.iOS) {
      if (mounted) setState(() => mapsReady = true);
      return;
    }
    try {
      final ready = await const MethodChannel(
        'ge.hungryman.work/platform',
      ).invokeMethod<bool>('mapsConfigured');
      if (mounted) setState(() => mapsReady = ready == true);
    } catch (_) {
      // Missing configuration must not instantiate the native Maps SDK.
    }
  }

  Timer? expiry;
  final durations = {
    '1 hour': const Duration(hours: 1),
    '8 hours': const Duration(hours: 8),
  };
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    checkMaps();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) stop();
  }

  Future<void> start() async {
    await act(context, () async {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw Exception('ჩართე ლოკაციის სერვისი');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw Exception('საჭიროა ლოკაციაზე წვდომა');
      }
      until = DateTime.now().add(durations[duration]!);
      final position = await Geolocator.getCurrentPosition();
      await upload(position);
      stream =
          Geolocator.getPositionStream(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 20,
            ),
          ).listen((p) {
            upload(p).catchError((Object e) {
              stop();
            });
          });
      expiry = Timer(durations[duration]!, stop);
      if (mounted) setState(() => sharing = true);
    });
  }

  Future<void> upload(Position p) async {
    if (until == null || DateTime.now().isAfter(until!)) {
      await stop();
      return;
    }
    await db.from('live_locations').upsert({
      'user_id': backend.uid,
      'shoot_id': widget.shootId,
      'latitude': p.latitude,
      'longitude': p.longitude,
      'expires_at': until!.toUtc().toIso8601String(),
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    });
    backend.changed();
  }

  Future<void> stop() async {
    await stream?.cancel();
    stream = null;
    expiry?.cancel();
    until = null;
    if (mounted && !closing) setState(() => sharing = false);
    try {
      await db.from('live_locations').delete().eq('user_id', backend.uid);
      backend.changed();
    } catch (_) {
      /* Server hides stale coordinates after five minutes. */
    }
  }

  @override
  void dispose() {
    closing = true;
    WidgetsBinding.instance.removeObserver(this);
    stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.shootId == null ? 'გუნდის ლოკაცია' : 'გუნდი რუკაზე'),
    ),
    body: Column(
      children: [
        Expanded(
          child: LiveData(
            'live_locations',
            order: 'updated_at',
            builder: (rows, off) => LiveData(
              'profiles',
              order: 'first_name',
              builder: (people, _) {
                final visible = rows
                    .where(
                      (r) =>
                          (widget.shootId == null ||
                              r['shoot_id'] == widget.shootId) &&
                          DateTime.parse(
                            r['expires_at'],
                          ).isAfter(DateTime.now()) &&
                          DateTime.now().difference(
                                DateTime.parse(r['updated_at']),
                              ) <
                              const Duration(minutes: 5),
                    )
                    .toList();
                return SizedBox(
                  height: MediaQuery.sizeOf(context).height * .58,
                  child: visible.isEmpty
                      ? const Empty('ლოკაციას არავინ აზიარებს')
                      : !mapsReady
                      ? ListView(
                          children: [
                            const ListTile(
                              title: Text('ლოკაციების რუკაზე გახსნა'),
                            ),
                            ...visible.map(
                              (r) => ListTile(
                                leading: const Icon(Icons.location_on),
                                title: Text(
                                  people
                                          .where((p) => p['id'] == r['user_id'])
                                          .map(person)
                                          .firstOrNull ??
                                      'გუნდის წევრი',
                                ),
                                trailing: const Icon(Icons.open_in_new),
                                onTap: () => launchUrl(
                                  Uri.https('maps.apple.com', '/', {
                                    'll': '${r['latitude']},${r['longitude']}',
                                  }),
                                  mode: LaunchMode.externalApplication,
                                ),
                              ),
                            ),
                          ],
                        )
                      : GoogleMap(
                          initialCameraPosition: CameraPosition(
                            target: LatLng(
                              visible.first['latitude'],
                              visible.first['longitude'],
                            ),
                            zoom: 12,
                          ),
                          markers: visible
                              .map(
                                (r) => Marker(
                                  markerId: MarkerId(r['user_id']),
                                  position: LatLng(
                                    r['latitude'],
                                    r['longitude'],
                                  ),
                                  infoWindow: InfoWindow(
                                    title:
                                        people
                                            .where(
                                              (p) => p['id'] == r['user_id'],
                                            )
                                            .map(person)
                                            .firstOrNull ??
                                        'გუნდის წევრი',
                                    snippet:
                                        'განახლდა ${r['updated_at']} • მარშრუტი',
                                    onTap: () => launchUrl(
                                      Uri.https('www.google.com', '/maps/dir/', {
                                        'api': '1',
                                        'destination':
                                            '${r['latitude']},${r['longitude']}',
                                      }),
                                      mode: LaunchMode.externalApplication,
                                    ),
                                  ),
                                ),
                              )
                              .toSet(),
                        ),
                );
              },
            ),
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Text(
                  widget.shootId == null
                      ? 'ხედავს: დამტკიცებული გუნდი'
                      : 'ხედავს: მხოლოდ ამ გადაღების გუნდი',
                ),
                const Text(
                  'ლოკაცია ზიარდება ამ გვერდის გახსნისას. გვერდის დატოვებისას გაზიარება წყდება.',
                  textAlign: TextAlign.center,
                ),
                if (sharing)
                  const Text(
                    'შენი ლოკაცია ზიარდება',
                    style: TextStyle(color: red, fontWeight: FontWeight.bold),
                  ),
                DropdownButton<String>(
                  value: duration,
                  items: durations.keys
                      .map(
                        (v) =>
                            DropdownMenuItem(value: v, child: Text(uiLabel(v))),
                      )
                      .toList(),
                  onChanged: sharing
                      ? null
                      : (v) => setState(() => duration = v!),
                ),
                FilledButton.icon(
                  onPressed: sharing ? stop : start,
                  icon: Icon(sharing ? Icons.stop : Icons.location_on),
                  label: Text(
                    sharing ? 'გაზიარების შეწყვეტა' : 'ლოკაციის გაზიარება',
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}
