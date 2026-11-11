import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:file_picker/file_picker.dart';
import '../core/backend.dart';
import '../core/ui.dart';
import '../core/production_time.dart';
import 'chat.dart';
import 'location.dart';

String timeLabel(dynamic s) =>
    s == null ? '—' : '${productionLabel(s.toString())} · თბილისი';
void editShoot(BuildContext c, {DbRow? row}) => go(
  c,
  RecordForm(
    title: row == null ? 'ახალი გადაღება' : 'გადაღების რედაქტირება',
    dateFields: const {'shoot_date'},
    dateTimeFields: const {
      'crew_call',
      'shoot_start',
      'lunch',
      'estimated_wrap',
    },
    fields: const {
      'project': 'პროექტი',
      'title': 'გადაღების სახელი',
      'shoot_date': 'გადაღების თარიღი',
      'crew_call': 'გუნდის შეკრება',
      'shoot_start': 'დაწყება (არასავალდებულო)',
      'lunch': 'შესვენება (არასავალდებულო)',
      'estimated_wrap': 'დასრულება (არასავალდებულო)',
      'description': 'აღწერა',
      'notes': 'შენიშვნები',
      'important_contacts': 'მნიშვნელოვანი კონტაქტები',
      'emergency_info': 'საგანგებო ინფორმაცია',
    },
    initial: row ?? {},
    save: (v) async {
      if (v['title'].isEmpty || v['project'].isEmpty) {
        throw Exception('სათაური და პროექტი აუცილებელია');
      }
      DateTime.parse(v['shoot_date']);
      for (final key in [
        'crew_call',
        'shoot_start',
        'lunch',
        'estimated_wrap',
      ]) {
        v[key] = v[key].isEmpty
            ? null
            : DateTime.parse(v[key]).toUtc().toIso8601String();
      }
      if (v['crew_call'] == null) throw Exception('შეკრების დრო აუცილებელია');
      if (row == null) {
        await backend.insert('shoots', v);
      } else {
        await backend.update('shoots', v, row['id']);
      }
    },
  ),
);

class ShootsPage extends StatefulWidget {
  final bool canProduce;
  const ShootsPage({required this.canProduce, super.key});
  @override
  State<ShootsPage> createState() => _ShootsPageState();
}

class _ShootsPageState extends State<ShootsPage> {
  String filter = 'მომავალი';
  DateTime? selected;
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      Row(
        children: [
          Expanded(
            child: Text(
              'გადაღებები',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.calendar_month),
            onPressed: () async {
              final d = await showDatePicker(
                context: context,
                initialDate: DateTime.now(),
                firstDate: DateTime(2020),
                lastDate: DateTime(2040),
              );
              if (d != null) setState(() => selected = d);
            },
          ),
          if (widget.canProduce)
            FilledButton.icon(
              onPressed: () => editShoot(context),
              icon: const Icon(Icons.add),
              label: const Text('გადაღების დამატება'),
            ),
        ],
      ),
      const SizedBox(height: 20),
      SegmentedButton<String>(
        segments: [
          'მომავალი',
          'დღეს',
          'გასული',
        ].map((s) => ButtonSegment(value: s, label: Text(s))).toList(),
        selected: {filter},
        onSelectionChanged: (v) => setState(() {
          filter = v.first;
          selected = null;
        }),
      ),
      if (selected != null)
        TextButton(
          onPressed: () => setState(() => selected = null),
          child: Text(
            'თარიღი: ${DateFormat('yyyy-MM-dd').format(selected!)} • გასუფთავება',
          ),
        ),
      const SizedBox(height: 16),
      LiveData(
        'shoots',
        order: 'crew_call',
        ascending: true,
        builder: (rows, off) {
          final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
          final visible = rows.where((r) {
            final d = r['shoot_date'] as String;
            if (selected != null) {
              return d == DateFormat('yyyy-MM-dd').format(selected!);
            }
            return filter == 'დღეს'
                ? d == today
                : filter == 'გასული'
                ? d.compareTo(today) < 0
                : d.compareTo(today) >= 0;
          }).toList();
          return visible.isEmpty
              ? const Empty('ამ პერიოდში გადაღებები არ არის')
              : Column(
                  children: visible
                      .map(
                        (r) =>
                            ShootCard(r, canProduce: widget.canProduce && !off),
                      )
                      .toList(),
                );
        },
      ),
    ],
  );
}

class ShootCard extends StatelessWidget {
  final DbRow row;
  final bool canProduce;
  const ShootCard(this.row, {required this.canProduce, super.key});
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      contentPadding: const EdgeInsets.all(18),
      leading: Container(
        width: 54,
        height: 64,
        decoration: BoxDecoration(
          color: navy,
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Icon(Icons.movie_outlined, color: Colors.white),
      ),
      title: Text(
        row['title'],
        style: const TextStyle(fontWeight: FontWeight.w800),
      ),
      subtitle: Text(
        '${row['project']}\n${timeLabel(row['crew_call'])} · ${uiLabel(row['status'])}',
      ),
      isThreeLine: true,
      trailing: const Icon(Icons.chevron_right),
      onTap: () =>
          go(context, ShootWorkspace(id: row['id'], canProduce: canProduce)),
    ),
  );
}

class ShootWorkspace extends StatefulWidget {
  final String id;
  final bool canProduce;
  const ShootWorkspace({required this.id, required this.canProduce, super.key});
  @override
  State<ShootWorkspace> createState() => _ShootWorkspaceState();
}

class _ShootWorkspaceState extends State<ShootWorkspace> {
  int tab = 0;
  final labels = [
    'მიმოხილვა',
    'გუნდი',
    'განრიგი',
    'ლოკაციები',
    'დავალებები',
    'ფაილები',
    'გადაღების ფურცელი',
  ];
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('გადაღების სამუშაო სივრცე'),
      actions: [
        IconButton(
          icon: const Icon(Icons.chat_bubble_outline),
          onPressed: () => act(context, () async {
            final c = await db
                .from('conversations')
                .select('id')
                .eq('shoot_id', widget.id)
                .single();
            if (context.mounted) {
              go(
                context,
                ChatPage(conversationId: c['id'], title: 'გადაღების ჩატი'),
              );
            }
          }),
        ),
        IconButton(
          icon: const Icon(Icons.location_on_outlined),
          onPressed: () => go(context, LocationPage(shootId: widget.id)),
        ),
      ],
    ),
    body: Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: List.generate(
              labels.length,
              (i) => Padding(
                padding: const EdgeInsets.all(4),
                child: ChoiceChip(
                  label: Text(labels[i]),
                  selected: tab == i,
                  onSelected: (_) => setState(() => tab = i),
                ),
              ),
            ),
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (tab == 0) overview(),
              if (tab == 1) crew(),
              if (tab == 2) schedule(),
              if (tab == 3) locations(),
              if (tab == 4) tasks(),
              if (tab == 5) files(),
              if (tab == 6) callSheet(),
            ],
          ),
        ),
      ],
    ),
  );
  Widget overview() => LiveData(
    'shoots',
    filters: {'id': widget.id},
    builder: (rows, off) {
      if (rows.isEmpty) return const Empty('გადაღება მიუწვდომელია');
      final s = rows.first;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: navy,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  s['project'],
                  style: const TextStyle(color: Colors.white70),
                ),
                Text(
                  s['title'],
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 28,
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'შეკრების დრო · ${timeLabel(s['crew_call'])}',
                  style: const TextStyle(color: Colors.white),
                ),
                Text(
                  s['status'],
                  style: const TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Section('აღწერა', child: Text(s['description'])),
          for (final f in ['shoot_start', 'lunch', 'estimated_wrap'])
            ListTile(title: Text(uiLabel(f)), subtitle: Text(timeLabel(s[f]))),
          if (widget.canProduce && !off)
            OutlinedButton.icon(
              onPressed: () => editShoot(context, row: s),
              icon: const Icon(Icons.edit),
              label: const Text('გადაღების რედაქტირება'),
            ),
        ],
      );
    },
  );
  Widget crew() => Column(
    children: [
      if (widget.canProduce)
        TextButton.icon(
          onPressed: () => go(context, CrewPicker(shootId: widget.id)),
          icon: const Icon(Icons.person_add),
          label: const Text('წევრის დამატება'),
        ),
      LiveData(
        'shoot_members',
        filters: {'shoot_id': widget.id},
        order: 'user_id',
        builder: (rows, off) => LiveData(
          'profiles',
          order: 'first_name',
          builder: (people, _) {
            return Column(
              children: [
                Text(
                  'მოდის ${rows.where((r) => r['attendance'] == 'going').length} • შესაძლოა ${rows.where((r) => r['attendance'] == 'maybe').length} • ვერ მოდის ${rows.where((r) => r['attendance'] == 'cant_go').length}',
                ),
                for (final r in rows)
                  ListTile(
                    leading: const CircleAvatar(child: Icon(Icons.person)),
                    title: Text(
                      people
                              .where((p) => p['id'] == r['user_id'])
                              .map(person)
                              .firstOrNull ??
                          'გუნდის წევრი',
                    ),
                    subtitle: Text(uiLabel(r['attendance'])),
                    trailing: r['user_id'] == backend.uid
                        ? PopupMenuButton<String>(
                            enabled: !off,
                            onSelected: (v) => act(
                              context,
                              () => backend.rpc('set_attendance', {
                                's': widget.id,
                                'value': v,
                              }),
                            ),
                            itemBuilder: (_) => ['going', 'maybe', 'cant_go']
                                .map(
                                  (v) => PopupMenuItem(
                                    value: v,
                                    child: Text(uiLabel(v)),
                                  ),
                                )
                                .toList(),
                          )
                        : widget.canProduce
                        ? IconButton(
                            icon: const Icon(Icons.person_remove_outlined),
                            onPressed: off
                                ? null
                                : () => act(context, () async {
                                    await db
                                        .from('shoot_members')
                                        .delete()
                                        .eq('shoot_id', widget.id)
                                        .eq('user_id', r['user_id']);
                                    backend.changed();
                                  }),
                          )
                        : null,
                  ),
              ],
            );
          },
        ),
      ),
    ],
  );
  void editSchedule(DbRow row) => go(
    context,
    RecordForm(
      title: 'განრიგის რედაქტირება',
      initial: row,
      dateTimeFields: const {'starts_at'},
      fields: const {
        'title': 'აქტივობა',
        'starts_at': 'თარიღი და დრო',
        'notes': 'შენიშვნები',
      },
      save: (values) async {
        if (values['title'].isEmpty || values['starts_at'].isEmpty) {
          throw Exception('აქტივობა და დრო აუცილებელია');
        }
        await backend.update('shoot_schedule', values, row['id']);
      },
    ),
  );

  Future<void> deleteSchedule(DbRow row) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('წავშალოთ აქტივობა?'),
        content: Text(row['title']),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: const Text('გაუქმება'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: const Text('წაშლა'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await act(context, () async {
      await db.from('shoot_schedule').delete().eq('id', row['id']);
      backend.changed();
    });
  }

  Widget schedule() => Column(
    children: [
      if (widget.canProduce)
        TextButton(
          onPressed: () => go(
            context,
            RecordForm(
              title: 'განრიგის აქტივობა',
              dateTimeFields: const {'starts_at'},
              fields: const {
                'title': 'აქტივობა',
                'starts_at': 'თარიღი და დრო',
                'notes': 'შენიშვნები',
              },
              save: (v) {
                v['starts_at'] = DateTime.parse(
                  v['starts_at'],
                ).toUtc().toIso8601String();
                return backend.insert('shoot_schedule', {
                  'shoot_id': widget.id,
                  ...v,
                });
              },
            ),
          ),
          child: const Text('აქტივობის დამატება'),
        ),
      LiveData(
        'shoot_schedule',
        filters: {'shoot_id': widget.id},
        order: 'starts_at',
        ascending: true,
        builder: (rows, off) => rows.isEmpty
            ? const Empty('განრიგი ჯერ არ არის')
            : Column(
                children: rows
                    .map(
                      (r) => ListTile(
                        leading: const Icon(Icons.schedule),
                        title: Text(r['title']),
                        subtitle: Text(timeLabel(r['starts_at'])),
                        trailing: widget.canProduce && !off
                            ? PopupMenuButton<String>(
                                onSelected: (action) => action == 'edit'
                                    ? editSchedule(r)
                                    : deleteSchedule(r),
                                itemBuilder: (_) => const [
                                  PopupMenuItem(
                                    value: 'edit',
                                    child: Text('რედაქტირება'),
                                  ),
                                  PopupMenuItem(
                                    value: 'delete',
                                    child: Text('წაშლა'),
                                  ),
                                ],
                              )
                            : null,
                      ),
                    )
                    .toList(),
              ),
      ),
    ],
  );
  Widget locations() => Column(
    children: [
      if (widget.canProduce)
        TextButton(
          onPressed: () => go(
            context,
            RecordForm(
              title: 'ლოკაციის დამატება',
              fields: const {
                'title': 'ლოკაციის სახელი',
                'kind':
                    'ტიპი: შეკრება / მთავარი / პარკინგი / შესვენება / სასტუმრო',
                'address': 'მისამართი',
                'latitude': 'განედი (არასავალდებულო)',
                'longitude': 'გრძედი (არასავალდებულო)',
              },
              save: (v) {
                for (final key in ['latitude', 'longitude']) {
                  v[key] = v[key].isEmpty ? null : double.parse(v[key]);
                }
                return backend.insert('shoot_locations', {
                  'shoot_id': widget.id,
                  ...v,
                });
              },
            ),
          ),
          child: const Text('ლოკაციის დამატება'),
        ),
      LiveData(
        'shoot_locations',
        filters: {'shoot_id': widget.id},
        order: 'title',
        builder: (rows, off) => rows.isEmpty
            ? const Empty('ლოკაციები ჯერ არ არის')
            : Column(
                children: rows
                    .map(
                      (r) => ListTile(
                        leading: const Icon(Icons.location_on, color: red),
                        title: Text(r['title']),
                        subtitle: Text(
                          '${uiLabel(r['kind'])} · ${r['address']}',
                        ),
                        trailing: const Icon(Icons.directions),
                        onTap: () => launchUrl(
                          Uri.https('www.google.com', '/maps/search/', {
                            'api': '1',
                            'query': r['latitude'] == null
                                ? r['address']
                                : '${r['latitude']},${r['longitude']}',
                          }),
                          mode: LaunchMode.externalApplication,
                        ),
                      ),
                    )
                    .toList(),
              ),
      ),
    ],
  );
  Widget tasks() => Column(
    children: [
      if (widget.canProduce)
        TextButton(
          onPressed: () => go(context, TaskEditor(shootId: widget.id)),
          child: const Text('დავალების მინიჭება'),
        ),
      LiveData(
        'tasks',
        filters: {'shoot_id': widget.id},
        builder: (rows, off) => Column(
          children: [
            Text(
              '${rows.where((r) => r['status'] == 'done').length} / ${rows.length} დასრულებულია',
            ),
            if (rows.isEmpty) const Empty('აქტიური დავალებები არ არის'),
            for (final r in rows)
              ListTile(
                title: Text(r['title']),
                subtitle: Text(
                  '${uiLabel(r['status'])} · ${timeLabel(r['due_at'])}',
                ),
                onTap: () => go(context, TaskDetails(task: r)),
                trailing: PopupMenuButton<String>(
                  enabled:
                      !off &&
                      (widget.canProduce || r['assigned_to'] == backend.uid),
                  onSelected: (v) => act(
                    context,
                    () => backend.rpc('set_task_status', {
                      't': r['id'],
                      'value': v,
                    }),
                  ),
                  itemBuilder: (_) => ['todo', 'in_progress', 'done']
                      .map(
                        (v) => PopupMenuItem(value: v, child: Text(uiLabel(v))),
                      )
                      .toList(),
                ),
              ),
          ],
        ),
      ),
    ],
  );
  Widget files() => Column(
    children: [
      TextButton.icon(
        onPressed: () => act(context, () async {
          final result = await FilePicker.platform.pickFiles(withData: true);
          if (result == null) return;
          final f = result.files.single;
          if (f.size > 100 * 1024 * 1024) {
            throw Exception('ფაილის მაქსიმალური ზომა: 100 მბ');
          }
          final path =
              '${widget.id}/${backend.uid}/${DateTime.now().microsecondsSinceEpoch}-${f.name.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_')}';
          await db.storage.from('production').uploadBinary(path, f.bytes!);
          try {
            await backend.insert('shoot_files', {
              'shoot_id': widget.id,
              'name': f.name,
              'storage_path': path,
            });
          } catch (_) {
            await db.storage.from('production').remove([path]);
            rethrow;
          }
        }),
        icon: const Icon(Icons.upload_file),
        label: const Text('ფაილის ატვირთვა'),
      ),
      LiveData(
        'shoot_files',
        filters: {'shoot_id': widget.id},
        builder: (rows, off) => rows.isEmpty
            ? const Empty('ფაილები ჯერ არ არის')
            : Column(
                children: rows
                    .map(
                      (r) => ListTile(
                        leading: const Icon(Icons.description_outlined),
                        title: Text(r['name']),
                        trailing: const Icon(Icons.download),
                        onTap: off
                            ? null
                            : () => act(context, () async {
                                final url = await db.storage
                                    .from('production')
                                    .createSignedUrl(r['storage_path'], 60);
                                await launchUrl(
                                  Uri.parse(url),
                                  mode: LaunchMode.externalApplication,
                                );
                              }),
                      ),
                    )
                    .toList(),
              ),
      ),
    ],
  );
  Widget callSheet() => LiveData(
    'call_sheets',
    filters: {'id': widget.id},
    builder: (rows, off) {
      if (rows.isEmpty) return const Empty('გადაღების ფურცელი მიუწვდომელია');
      final s = rows.first;
      return Section(
        'გადაღების ფურცელი • მიმდინარე ვერსია',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              s['project'],
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 22),
            ),
            Text(s['title']),
            Text('თარიღი: ${s['shoot_date']}'),
            Text('შეკრების დრო: ${timeLabel(s['crew_call'])}'),
            Text('გადაღების დაწყება: ${timeLabel(s['shoot_start'])}'),
            const Divider(),
            for (final l in s['locations'])
              ListTile(
                title: Text(l['title']),
                subtitle: Text(l['address']),
                trailing: const Icon(Icons.directions),
                onTap: () => launchUrl(
                  Uri.https('www.google.com', '/maps/search/', {
                    'api': '1',
                    'query': l['latitude'] == null
                        ? l['address']
                        : '${l['latitude']},${l['longitude']}',
                  }),
                  mode: LaunchMode.externalApplication,
                ),
              ),
            const Divider(),
            for (final e in s['schedule'])
              Text('${timeLabel(e['starts_at'])} — ${e['title']}'),
            const Divider(),
            Text('გუნდი: ${(s['crew'] as List).length}'),
            crew(),
            Text('შენიშვნები\n${s['notes']}'),
            const SizedBox(height: 12),
            Text('მნიშვნელოვანი კონტაქტები\n${s['important_contacts']}'),
            const SizedBox(height: 12),
            Text('საგანგებო ინფორმაცია\n${s['emergency_info']}'),
          ],
        ),
      );
    },
  );
}

class CrewPicker extends StatelessWidget {
  final String shootId;
  const CrewPicker({required this.shootId, super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('წევრის დამატება')),
    body: SingleChildScrollView(
      child: LiveData(
        'profiles',
        filters: const {'status': 'approved'},
        order: 'first_name',
        builder: (rows, off) => Column(
          children: rows
              .map(
                (r) => ListTile(
                  title: Text(person(r)),
                  trailing: const Icon(Icons.add),
                  onTap: off
                      ? null
                      : () => act(context, () async {
                          await db
                              .from('shoot_members')
                              .upsert(
                                {'shoot_id': shootId, 'user_id': r['id']},
                                onConflict: 'shoot_id,user_id',
                                ignoreDuplicates: true,
                              );
                          backend.changed();
                          if (context.mounted) Navigator.pop(context);
                        }),
                ),
              )
              .toList(),
        ),
      ),
    ),
  );
}

class TaskEditor extends StatelessWidget {
  final String shootId;
  const TaskEditor({required this.shootId, super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('თანამშრომლის არჩევა')),
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
                  onTap: () => go(
                    context,
                    RecordForm(
                      title: 'დავალება: ${person(p)}',
                      dateTimeFields: const {'due_at'},
                      fields: const {
                        'title': 'დავალების სათაური',
                        'description': 'აღწერა',
                        'due_at': 'ვადა (არასავალდებულო)',
                      },
                      save: (v) {
                        v['due_at'] = v['due_at'].isEmpty
                            ? null
                            : DateTime.parse(
                                v['due_at'],
                              ).toUtc().toIso8601String();
                        return backend.insert('tasks', {
                          'shoot_id': shootId,
                          'assigned_to': p['id'],
                          ...v,
                        });
                      },
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ),
    ),
  );
}

class TaskDetails extends StatelessWidget {
  final DbRow task;
  const TaskDetails({required this.task, super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(task['title'])),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(task['description']),
        Text('ვადა: ${timeLabel(task['due_at'])}'),
        LiveData(
          'task_comments',
          filters: {'task_id': task['id']},
          ascending: true,
          builder: (rows, off) => Column(
            children: rows
                .map(
                  (r) => ListTile(
                    title: Text(r['body']),
                    subtitle: Text(timeLabel(r['created_at'])),
                  ),
                )
                .toList(),
          ),
        ),
        TextButton(
          onPressed: () => go(
            context,
            RecordForm(
              title: 'კომენტარი',
              fields: const {'body': 'კომენტარი'},
              save: (v) => backend.insert('task_comments', {
                'task_id': task['id'],
                ...v,
              }),
            ),
          ),
          child: const Text('კომენტარის დამატება'),
        ),
      ],
    ),
  );
}
