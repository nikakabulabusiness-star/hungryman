import 'package:flutter/material.dart';
import '../core/backend.dart';
import '../core/ui.dart';
import 'shoots.dart';

class AdminPage extends StatelessWidget {
  final bool canPeople, canProduce, canAudit;
  const AdminPage({
    required this.canPeople,
    required this.canProduce,
    required this.canAudit,
    super.key,
  });
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Hungryman Work • მართვა')),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Text(
          'წარმოების მართვა',
          style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 20),
        if (canPeople)
          Section(
            'თანამშრომლების დამტკიცება',
            child: LiveData(
              'profiles',
              order: 'created_at',
              builder: (rows, off) => Column(
                children: rows
                    .map(
                      (p) => ListTile(
                        title: Text(person(p)),
                        subtitle: Text(uiLabel(p['status'])),
                        trailing: const Icon(Icons.manage_accounts),
                        onTap: () => go(context, ManageEmployee(profile: p)),
                      ),
                    )
                    .toList(),
              ),
            ),
          ),
        if (canProduce)
          Section(
            'წარმოება',
            child: FilledButton(
              onPressed: () => go(
                context,
                Scaffold(
                  appBar: AppBar(title: const Text('გადაღებების მართვა')),
                  body: const ShootsPage(canProduce: true),
                ),
              ),
              child: const Text(
                'გადაღებები • გუნდი • განრიგი • დავალებები • ფაილები',
              ),
            ),
          ),
        if (canPeople)
          Section(
            'ოფიციალური განცხადებები',
            child: FilledButton(
              onPressed: () => go(
                context,
                RecordForm(
                  title: 'განცხადების გამოქვეყნება',
                  fields: const {'title': 'სათაური', 'body': 'განცხადება'},
                  save: (v) => backend.insert('announcements', v),
                ),
              ),
              child: const Text('ახალი განცხადება'),
            ),
          ),
        if (canAudit)
          Section(
            'ცვლილებების ისტორია',
            child: LiveData(
              'audit_logs',
              builder: (rows, off) => Column(
                children: rows
                    .map(
                      (r) => ExpansionTile(
                        title: Text('${r['entity']} · ${r['action']}'),
                        subtitle: Text(
                          '${r['created_at']} · ${r['actor_id'] ?? 'system'}',
                        ),
                        children: [
                          SelectableText(
                            'მანამდე: ${r['before_data']}\nშემდეგ: ${r['after_data']}',
                          ),
                        ],
                      ),
                    )
                    .toList(),
              ),
            ),
          ),
      ],
    ),
  );
}

class ManageEmployee extends StatefulWidget {
  final DbRow profile;
  const ManageEmployee({required this.profile, super.key});
  @override
  State<ManageEmployee> createState() => _ManageEmployeeState();
}

class _ManageEmployeeState extends State<ManageEmployee> {
  Set<String> selected = {};
  String status = 'pending';
  bool ready = false, busy = false;
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final rows = await db
          .from('user_roles')
          .select('role_id')
          .eq('user_id', widget.profile['id']);
      if (mounted) {
        setState(() {
          selected = rows.map((r) => r['role_id'] as String).toSet();
          status = widget.profile['status'];
          ready = true;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('მართვა: ${person(widget.profile)}')),
    body: !ready
        ? Center(
            child: error == null
                ? const CircularProgressIndicator()
                : Text(error!),
          )
        : ListView(
            padding: const EdgeInsets.all(24),
            children: [
              if (selected.contains('owner'))
                const Empty('იუთუბერი • დაცული მფლობელის ანგარიში')
              else ...[
                DropdownButtonFormField<String>(
                  initialValue: status,
                  items: ['pending', 'approved', 'disabled']
                      .map(
                        (s) =>
                            DropdownMenuItem(value: s, child: Text(uiLabel(s))),
                      )
                      .toList(),
                  onChanged: (v) => setState(() => status = v!),
                ),
                const SizedBox(height: 16),
                LiveData(
                  'roles',
                  order: 'label',
                  builder: (rows, off) => Column(
                    children: rows
                        .where((r) => r['id'] != 'owner')
                        .map(
                          (r) => CheckboxListTile(
                            title: Text(uiLabel(r['id'])),
                            value: selected.contains(r['id']),
                            onChanged: (v) => setState(() {
                              v!
                                  ? selected.add(r['id'])
                                  : selected.remove(r['id']);
                            }),
                          ),
                        )
                        .toList(),
                  ),
                ),
                if (error != null)
                  Text(error!, style: const TextStyle(color: red)),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () async {
                          setState(() => busy = true);
                          try {
                            await backend.rpc('manage_employee', {
                              'employee': widget.profile['id'],
                              'new_status': status,
                              'new_roles': selected.toList(),
                            });
                            if (context.mounted) Navigator.pop(context);
                          } catch (e) {
                            if (mounted) setState(() => error = e.toString());
                          } finally {
                            if (mounted) setState(() => busy = false);
                          }
                        },
                  child: const Text('თანამშრომლის შენახვა'),
                ),
              ],
            ],
          ),
  );
}
