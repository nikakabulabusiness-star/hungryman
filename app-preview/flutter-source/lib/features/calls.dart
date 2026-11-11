import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart';
import '../core/backend.dart';
import '../core/ui.dart';
import 'location.dart';

Future<void> startCall(BuildContext c, List<String> people, bool video) =>
    act(c, () async {
      final id = await db.rpc(
        'start_call',
        params: {'people': people, 'with_video': video},
      );
      backend.changed();
      if (c.mounted) go(c, ActiveCall(callId: id, video: video));
    });

class CallsPage extends StatelessWidget {
  const CallsPage({super.key});
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      Text('ზარები', style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: 20),
      LiveData(
        'calls',
        builder: (rows, off) => rows.isEmpty
            ? const Empty('ზარები ჯერ არ არის')
            : Column(
                children: rows
                    .map(
                      (r) => Card(
                        child: ListTile(
                          leading: Icon(
                            r['video'] ? Icons.videocam : Icons.call,
                            color: r['status'] == 'missed' ? red : navy,
                          ),
                          title: Text(
                            '${r['video'] ? 'ვიდეო' : 'აუდიო'}ზარი · ${uiLabel(r['status'])}',
                          ),
                          subtitle: Text(
                            '${r['created_by'] == backend.uid ? 'გამავალი' : 'შემომავალი'} · ${r['created_at']}',
                          ),
                          trailing: ['ringing', 'active'].contains(r['status'])
                              ? FilledButton(
                                  onPressed: off
                                      ? null
                                      : () => go(
                                          context,
                                          ActiveCall(
                                            callId: r['id'],
                                            video: r['video'],
                                          ),
                                        ),
                                  child: const Text('შეერთება'),
                                )
                              : null,
                        ),
                      ),
                    )
                    .toList(),
              ),
      ),
    ],
  );
}

class ActiveCall extends StatefulWidget {
  final String callId;
  final bool video;
  const ActiveCall({required this.callId, required this.video, super.key});
  @override
  State<ActiveCall> createState() => _ActiveCallState();
}

class _ActiveCallState extends State<ActiveCall> {
  final room = Room();
  bool mic = true, cam = false, connected = false;
  String? error;
  @override
  void initState() {
    super.initState();
    connect();
  }

  Future<void> connect() async {
    try {
      final response = await db.functions.invoke(
        'call-token',
        body: {'call_id': widget.callId},
      );
      final data = response.data as Map;
      await room.connect(data['url'], data['token']);
      await room.localParticipant?.setMicrophoneEnabled(true);
      if (widget.video) await room.localParticipant?.setCameraEnabled(true);
      if (mounted) {
        setState(() {
          connected = true;
          cam = widget.video;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(
          () => error =
              'ზართან დაკავშირება ვერ მოხერხდა. შეამოწმე მიკროფონისა და კამერის ნებართვები.',
        );
      }
    }
  }

  @override
  void dispose() {
    room.disconnect();
    room.dispose();
    super.dispose();
  }

  Widget tile(Participant p) {
    final tracks = p.videoTrackPublications
        .where((t) => t.track != null && !t.muted)
        .toList();
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: ColoredBox(
        color: navy,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (tracks.isNotEmpty)
              VideoTrackRenderer(tracks.first.track as VideoTrack)
            else
              const Icon(Icons.person, size: 72, color: Colors.white54),
            Align(
              alignment: Alignment.bottomLeft,
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Text(
                  p.name.isEmpty ? 'გუნდის წევრი' : p.name,
                  style: const TextStyle(color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF07121D),
    appBar: AppBar(
      title: const Text('გუნდის ზარი'),
      actions: [
        IconButton(
          onPressed: () => go(context, AddCallPeople(callId: widget.callId)),
          icon: const Icon(Icons.person_add),
        ),
        IconButton(
          onPressed: () => go(context, const LocationPage()),
          icon: const Icon(Icons.location_on),
        ),
      ],
    ),
    body: error != null
        ? Center(
            child: Text(error!, style: const TextStyle(color: Colors.white)),
          )
        : !connected
        ? const Center(child: CircularProgressIndicator())
        : Column(
            children: [
              Expanded(
                child: ListenableBuilder(
                  listenable: room,
                  builder: (context, _) {
                    final participants = <Participant>[
                      if (room.localParticipant != null) room.localParticipant!,
                      ...room.remoteParticipants.values,
                    ];
                    return GridView.count(
                      padding: const EdgeInsets.all(16),
                      crossAxisCount: participants.length > 1 ? 2 : 1,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                      children: participants.map(tile).toList(),
                    );
                  },
                ),
              ),
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      IconButton.filled(
                        onPressed: () => act(context, () async {
                          await room.localParticipant?.setMicrophoneEnabled(
                            !mic,
                          );
                          setState(() => mic = !mic);
                        }),
                        icon: Icon(mic ? Icons.mic : Icons.mic_off),
                      ),
                      IconButton.filled(
                        onPressed: () => act(context, () async {
                          await room.localParticipant?.setCameraEnabled(!cam);
                          setState(() => cam = !cam);
                        }),
                        icon: Icon(cam ? Icons.videocam : Icons.videocam_off),
                      ),
                      IconButton.filled(
                        style: IconButton.styleFrom(backgroundColor: red),
                        onPressed: () => act(context, () async {
                          await backend.rpc('end_call', {'c': widget.callId});
                          await room.disconnect();
                          if (context.mounted) Navigator.pop(context);
                        }),
                        icon: const Icon(Icons.call_end),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
  );
}

class AddCallPeople extends StatelessWidget {
  final String callId;
  const AddCallPeople({required this.callId, super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('ზარში დამატება')),
    body: SingleChildScrollView(
      child: LiveData(
        'profiles',
        filters: const {'status': 'approved'},
        order: 'first_name',
        builder: (rows, off) => Column(
          children: rows
              .map(
                (p) => ListTile(
                  title: Text(person(p)),
                  onTap: off
                      ? null
                      : () => act(
                          context,
                          () => backend.rpc('add_call_person', {
                            'c': callId,
                            'person_id': p['id'],
                          }),
                        ),
                ),
              )
              .toList(),
        ),
      ),
    ),
  );
}
