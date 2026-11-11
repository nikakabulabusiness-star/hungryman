import 'package:flutter_localizations/flutter_localizations.dart';
// Browser-only demo entrypoint. Production main.dart never imports this file.
import 'dart:convert';
import 'package:flutter/material.dart';
// ignore: depend_on_referenced_packages
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/ui.dart';
import 'features/shell.dart';

const me = '00000000-0000-0000-0000-000000000010';
const shoot = '00000000-0000-0000-0000-000000000020';
const team = '00000000-0000-0000-0000-000000000001';
final demo = DemoClient();
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: 'https://preview.invalid',
    publishableKey: 'preview-public',
    httpClient: demo,
    authOptions: const FlutterAuthClientOptions(
      autoRefreshToken: false,
      detectSessionInUri: false,
      persistSession: false,
    ),
  );
  await Supabase.instance.client.auth.setSession('demo-session');
  runApp(const PreviewApp());
}

class PreviewApp extends StatefulWidget {
  const PreviewApp({super.key});
  @override
  State<PreviewApp> createState() => _PreviewAppState();
}

class _PreviewAppState extends State<PreviewApp> {
  bool dark = true;
  @override
  Widget build(BuildContext context) => MaterialApp(
    locale: const Locale('ka'),
    supportedLocales: const [Locale('ka')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    title: 'Hungryman Work • სატესტო ვერსია',
    debugShowCheckedModeBanner: false,
    theme: appTheme(Brightness.light),
    darkTheme: appTheme(Brightness.dark),
    themeMode: dark ? ThemeMode.dark : ThemeMode.light,
    builder: (context, child) => Column(
      children: [
        Material(
          color: const Color(0xFF0B2746),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'სატესტო ვერსია • სატესტო მონაცემები • განახლებისას ცვლილებები იშლება',
                      style: TextStyle(color: Colors.white, fontSize: 12),
                    ),
                  ),
                  IconButton(
                    onPressed: () => setState(() => dark = !dark),
                    icon: Icon(
                      dark ? Icons.light_mode : Icons.dark_mode,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        Expanded(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1000),
              child: child!,
            ),
          ),
        ),
      ],
    ),
    home: WorkShell(
      profile: demo.tables['profiles']!.first,
      roles: const ['owner'],
      preview: true,
    ),
  );
}

class DemoClient extends http.BaseClient {
  final tables = <String, List<Map<String, dynamic>>>{};
  int serial = 100;
  DemoClient() {
    final tomorrow = DateTime.now().toUtc().add(const Duration(days: 1));
    final call = DateTime.utc(tomorrow.year, tomorrow.month, tomorrow.day, 4);
    final stamp = DateTime.now().toUtc().toIso8601String();
    tables['profiles'] = [
      {
        'id': me,
        'first_name': 'Hungryman',
        'last_name': 'სატესტო',
        'status': 'approved',
        'phone': '',
        'created_at': stamp,
      },
      {
        'id': 'crew2',
        'first_name': 'სატესტო',
        'last_name': 'პროდიუსერი',
        'status': 'approved',
        'phone': '',
        'created_at': stamp,
      },
      {
        'id': 'crew3',
        'first_name': 'სატესტო',
        'last_name': 'კამერა',
        'status': 'approved',
        'phone': '',
        'created_at': stamp,
      },
      {
        'id': 'crew4',
        'first_name': 'სატესტო',
        'last_name': 'მონტაჟის სპეციალისტი',
        'status': 'approved',
        'phone': '',
        'created_at': stamp,
      },
    ];
    tables['user_roles'] = [
      {'user_id': me, 'role_id': 'owner'},
      {'user_id': 'crew2', 'role_id': 'producer'},
      {'user_id': 'crew3', 'role_id': 'camera'},
      {'user_id': 'crew4', 'role_id': 'editor'},
    ];
    tables['shoots'] = [
      {
        'id': shoot,
        'project': 'HUNGRYMAN',
        'title': 'ახალი ეპიზოდი — სტუდიის გადაღება',
        'shoot_date': call.toIso8601String().substring(0, 10),
        'crew_call': call.toIso8601String(),
        'shoot_start': call.add(const Duration(hours: 1)).toIso8601String(),
        'lunch': call.add(const Duration(hours: 5)).toIso8601String(),
        'estimated_wrap': call.add(const Duration(hours: 9)).toIso8601String(),
        'status': 'confirmed',
        'description':
            'გუნდის სატესტო სამუშაო სივრცე. გახსენი განრიგი, გუნდი და დავალებები.',
        'notes': 'სატესტო მონაცემები — რეალური გადაღება არ არის.',
        'important_contacts': 'გადაღების გუნდი',
        'emergency_info': '112',
        'created_at': stamp,
      },
    ];
    tables['tasks'] = [
      {
        'id': 'task1',
        'shoot_id': shoot,
        'assigned_to': me,
        'title': 'სცენარის საბოლოო ვერსიის შემოწმება',
        'description': 'გადახედე შესავალსა და გადაღების გეგმას.',
        'status': 'todo',
        'due_at': call.toIso8601String(),
        'created_at': stamp,
      },
      {
        'id': 'task2',
        'shoot_id': shoot,
        'assigned_to': me,
        'title': 'კამერების და ხმის შემოწმება',
        'description': 'მოამზადე ტექნიკა გადაღებისთვის.',
        'status': 'todo',
        'due_at': call.toIso8601String(),
        'created_at': stamp,
      },
    ];
    tables['messages'] = [
      {
        'id': 'msg1',
        'conversation_id': team,
        'author_id': 'crew2',
        'body':
            'გუნდი, ხვალ 08:00-ზე ვიკრიბებით. განრიგი უკვე სამუშაო სივრცეშია.',
        'created_at': stamp,
      },
      {
        'id': 'msg2',
        'conversation_id': team,
        'author_id': me,
        'body': 'მშვენიერია! სცენარს დღეს გადავხედავ.',
        'created_at': stamp,
      },
    ];
    tables['pins'] = [
      {'id': 'pin1', 'message_id': 'msg1', 'created_at': stamp},
    ];
    tables['announcements'] = [
      {
        'id': 'announce1',
        'title': 'კეთილი იყოს შენი მობრძანება',
        'body':
            'ეს არის Hungryman Work-ის ინტერაქტიული სატესტო ვერსია. ცვლილებები მხოლოდ ამ ბრაუზერის მიმდინარე სესიაში ინახება.',
        'created_at': stamp,
      },
    ];
    tables['shoot_schedule'] = [
      {
        'id': 'schedule1',
        'shoot_id': shoot,
        'title': 'გუნდის შეკრება / ტექნიკის მომზადება',
        'starts_at': call.toIso8601String(),
        'notes': '',
        'created_at': stamp,
      },
      {
        'id': 'schedule2',
        'shoot_id': shoot,
        'title': 'პირველი სცენის გადაღება',
        'starts_at': call.add(const Duration(hours: 1)).toIso8601String(),
        'notes': '',
        'created_at': stamp,
      },
    ];
    tables['shoot_locations'] = [
      {
        'id': 'location1',
        'shoot_id': shoot,
        'title': 'თბილისი — სატესტო ლოკაცია',
        'kind': 'Main',
        'address': 'თბილისი, საქართველო',
        'latitude': 41.7151,
        'longitude': 44.8271,
        'created_at': stamp,
      },
    ];
    tables['shoot_members'] = tables['profiles']!
        .map(
          (p) => {
            'id': 'member-${p['id']}',
            'shoot_id': shoot,
            'user_id': p['id'],
            'attendance': 'going',
            'created_at': stamp,
          },
        )
        .toList();
    tables['conversations'] = [
      {'id': team, 'kind': 'team', 'shoot_id': shoot, 'created_at': stamp},
    ];
    tables['calls'] = [];
  }
  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    http.StreamedResponse response(Object? data, {int status = 200}) =>
        http.StreamedResponse(
          Stream.value(utf8.encode(jsonEncode(data))),
          status,
          request: request,
          headers: {'content-type': 'application/json'},
        );
    final raw = await request.finalize().bytesToString();
    final body = raw.isEmpty ? <String, dynamic>{} : jsonDecode(raw);
    final path = request.url.path;
    if (path.startsWith('/auth/')) {
      final tokenPart = base64Url
          .encode(
            utf8.encode(
              jsonEncode({
                'sub': me,
                'exp': 4102444800,
                'role': 'authenticated',
              }),
            ),
          )
          .replaceAll('=', '');
      return response({
        'access_token': 'eyJhbGciOiJIUzI1NiJ9.$tokenPart.demo',
        'refresh_token': 'demo-session',
        'token_type': 'bearer',
        'expires_in': 86400,
        'user': {
          'id': me,
          'aud': 'authenticated',
          'role': 'authenticated',
          'email': 'demo@example.invalid',
          'app_metadata': {},
          'user_metadata': {},
          'created_at': DateTime.now().toUtc().toIso8601String(),
        },
      });
    }
    if (!path.startsWith('/rest/v1/')) {
      return response({
        'message':
            'სატესტო ვერსია: ზარები და ატვირთვა რეალურ სერვერთან დაკავშირებას მოითხოვს.',
      }, status: 400);
    }
    if (path.contains('/rpc/')) {
      final rpc = path.split('/').last;
      if (rpc == 'set_task_status') {
        for (final row in tables['tasks']!) {
          if (row['id'] == body['t']) row['status'] = body['value'];
        }
        return response(null);
      }
      if (rpc == 'private_conversation') return response(team);
      return response({
        'message': 'ამ მოქმედებისთვის რეალურ სერვერთან კავშირია საჭირო.',
      }, status: 400);
    }
    final table = path.split('/').last;
    if (table == 'call_sheets') {
      tables[table] = tables['shoots']!
          .map(
            (s) => {
              ...s,
              'locations': tables['shoot_locations']!
                  .where((r) => r['shoot_id'] == s['id'])
                  .toList(),
              'schedule': tables['shoot_schedule']!
                  .where((r) => r['shoot_id'] == s['id'])
                  .toList(),
              'crew': tables['profiles'],
            },
          )
          .toList();
    }
    if (table == 'pinned_messages') {
      tables[table] = (tables['pins'] ?? [])
          .expand(
            (p) => tables['messages']!.where((m) => m['id'] == p['message_id']),
          )
          .toList();
    }
    final all = tables.putIfAbsent(table, () => []);
    bool matches(Map<String, dynamic> row) {
      for (final e in request.url.queryParameters.entries) {
        if (e.value.startsWith('eq.') &&
            row[e.key]?.toString() != e.value.substring(3)) {
          return false;
        }
      }
      return true;
    }

    var selected = all.where(matches).toList();
    if (request.method == 'POST') {
      final values = body is List ? body : [body];
      for (final value in values) {
        final row = Map<String, dynamic>.from(value);
        row.putIfAbsent('id', () => 'demo-${serial++}');
        row.putIfAbsent(
          'created_at',
          () => DateTime.now().toUtc().toIso8601String(),
        );
        if (table == 'messages') row.putIfAbsent('author_id', () => me);
        if (table == 'shoots') row.putIfAbsent('status', () => 'planned');
        if (table == 'tasks') row.putIfAbsent('status', () => 'todo');
        all.add(row);
      }
      return response(values, status: 201);
    }
    if (request.method == 'PATCH') {
      for (final row in selected) {
        row.addAll(Map<String, dynamic>.from(body));
      }
    }
    if (request.method == 'DELETE') {
      all.removeWhere(matches);
      return response(null);
    }
    final order = request.url.queryParameters['order'];
    if (order != null) {
      final parts = order.split('.');
      selected.sort(
        (a, b) =>
            (parts.contains('desc') ? -1 : 1) *
            (a[parts.first]?.toString() ?? '').compareTo(
              b[parts.first]?.toString() ?? '',
            ),
      );
    }
    final limit = int.tryParse(request.url.queryParameters['limit'] ?? '');
    if (limit != null) selected = selected.take(limit).toList();
    if ((request.headers['Accept'] ?? request.headers['accept'] ?? '').contains(
      'vnd.pgrst.object',
    )) {
      return selected.isEmpty
          ? response({'message': 'სატესტო ჩანაწერი არ არის'}, status: 406)
          : response(selected.first);
    }
    return response(selected);
  }
}
