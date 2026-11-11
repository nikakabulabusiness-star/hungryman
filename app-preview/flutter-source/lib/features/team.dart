import 'package:flutter/material.dart';
import '../core/app_lock.dart';
import '../core/backend.dart';
import '../core/ui.dart';
import 'chat.dart';
import 'calls.dart';
import 'location.dart';
import 'admin.dart';

class TeamPage extends StatefulWidget {
  final bool canManage;
  const TeamPage({required this.canManage, super.key});
  @override
  State<TeamPage> createState() => _TeamPageState();
}

class _TeamPageState extends State<TeamPage> {
  String search = '', filter = 'ყველა';
  final groups = {
    'ყველა': <String>[],
    'იუთუბერები': ['owner'],
    'წარმოება': ['director', 'producer', 'writer', 'organizer'],
    'კამერა': ['camera', 'technical'],
    'მონტაჟი': ['editor', 'shorts_editor'],
    'სოციალური მედია': ['social', 'content'],
    'ხმა': ['sound_operator', 'sound_director'],
    'კადრები': ['hr'],
  };
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      Row(
        children: [
          Expanded(
            child: Text(
              'გუნდი',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ),
          IconButton(
            onPressed: () => go(context, const LocationPage()),
            icon: const Icon(Icons.location_on_outlined, color: red),
          ),
        ],
      ),
      TextField(
        onChanged: (v) => setState(() => search = v.toLowerCase()),
        decoration: const InputDecoration(
          prefixIcon: Icon(Icons.search),
          hintText: 'გუნდის წევრის ძიება',
        ),
      ),
      const SizedBox(height: 12),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: groups.keys
              .map(
                (s) => Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(s),
                    selected: filter == s,
                    onSelected: (_) => setState(() => filter = s),
                  ),
                ),
              )
              .toList(),
        ),
      ),
      const SizedBox(height: 12),
      LiveData(
        'user_roles',
        order: 'user_id',
        builder: (roles, off) => LiveData(
          'profiles',
          order: 'first_name',
          filters: const {'status': 'approved'},
          builder: (rows, _) {
            final visible = rows
                .where(
                  (p) =>
                      person(p).toLowerCase().contains(search) &&
                      (filter == 'ყველა' ||
                          roles.any(
                            (r) =>
                                r['user_id'] == p['id'] &&
                                groups[filter]!.contains(r['role_id']),
                          )),
                )
                .toList();
            return visible.isEmpty
                ? const Empty('გუნდის წევრი ვერ მოიძებნა')
                : Column(
                    children: visible
                        .map(
                          (p) => Card(
                            child: ListTile(
                              leading: CircleAvatar(
                                child: Text(
                                  person(p).isEmpty ? 'H' : person(p)[0],
                                ),
                              ),
                              title: Text(person(p)),
                              subtitle: Text(
                                roles
                                    .where((r) => r['user_id'] == p['id'])
                                    .map(
                                      (r) => r['role_id'] == 'owner'
                                          ? 'იუთუბერი'
                                          : uiLabel(r['role_id']),
                                    )
                                    .join(' · '),
                              ),
                              trailing: const Icon(Icons.chevron_right),
                              onTap: () => go(
                                context,
                                EmployeePage(
                                  profile: p,
                                  canManage: widget.canManage,
                                ),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  );
          },
        ),
      ),
    ],
  );
}

class EmployeePage extends StatelessWidget {
  final DbRow profile;
  final bool canManage;
  const EmployeePage({
    required this.profile,
    required this.canManage,
    super.key,
  });
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('გუნდის წევრი')),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const CircleAvatar(radius: 45, child: Icon(Icons.person, size: 44)),
        const SizedBox(height: 16),
        Text(
          person(profile),
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 24),
        FilledButton.icon(
          onPressed: () => act(context, () async {
            final id = await db.rpc(
              'open_private_chat',
              params: {'other_user': profile['id']},
            );
            if (context.mounted) {
              go(
                context,
                ChatPage(
                  conversationId: id,
                  title: person(profile),
                  otherUser: profile['id'],
                ),
              );
            }
          }),
          icon: const Icon(Icons.chat_bubble_outline),
          label: const Text('შეტყობინება'),
        ),
        OutlinedButton.icon(
          onPressed: () => startCall(context, [profile['id']], false),
          icon: const Icon(Icons.call),
          label: const Text('აუდიოზარი'),
        ),
        OutlinedButton.icon(
          onPressed: () => startCall(context, [profile['id']], true),
          icon: const Icon(Icons.videocam),
          label: const Text('ვიდეოზარი'),
        ),
        ListTile(
          title: const Text('ტელეფონი'),
          subtitle: Text(profile['phone'] ?? ''),
        ),
        TextButton(
          onPressed: () => go(
            context,
            RecordForm(
              title: 'პირადი მეტსახელი',
              fields: const {'nickname': 'მხოლოდ შენ ხედავ'},
              save: (v) async {
                await db.from('personal_nicknames').upsert({
                  'user_id': backend.uid,
                  'target_id': profile['id'],
                  ...v,
                });
                backend.changed();
              },
            ),
          ),
          child: const Text('მეტსახელის დაყენება'),
        ),
        LiveData(
          'personal_nicknames',
          filters: {'target_id': profile['id']},
          order: 'target_id',
          builder: (rows, _) => Text(
            rows.isEmpty ? '' : rows.first['nickname'],
            textAlign: TextAlign.center,
          ),
        ),
        if (canManage)
          TextButton(
            onPressed: () => go(context, ManageEmployee(profile: profile)),
            child: const Text('თანამშრომლის მართვა'),
          ),
      ],
    ),
  );
}

class ProfilePage extends StatelessWidget {
  final DbRow profile;
  const ProfilePage({required this.profile, super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('ჩემი პროფილი')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        Text(
          person(profile),
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        Text(db.auth.currentUser?.email ?? ''),
        TextButton(
          onPressed: () => go(
            context,
            RecordForm(
              title: 'პროფილის რედაქტირება',
              fields: const {
                'first_name': 'სახელი',
                'last_name': 'გვარი',
                'nickname': 'მეტსახელი',
                'phone': 'ტელეფონის ნომერი',
              },
              initial: profile,
              save: (v) => backend.update('profiles', v, backend.uid),
            ),
          ),
          child: const Text('პროფილის რედაქტირება'),
        ),
        const AppLockSettings(),
        TextButton(
          onPressed: () => go(context, const NotificationSettings()),
          child: const Text('შეტყობინებების პარამეტრები'),
        ),
      ],
    ),
  );
}

class NotificationSettings extends StatelessWidget {
  const NotificationSettings({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('შეტყობინებების პარამეტრები')),
    body: SingleChildScrollView(
      child: LiveData(
        'notification_preferences',
        order: 'user_id',
        builder: (rows, off) {
          final r = rows.isEmpty ? <String, dynamic>{} : rows.first;
          return Column(
            children: ['main_chat', 'mentions', 'shoot_changes', 'calls']
                .map(
                  (key) => SwitchListTile(
                    title: Text(uiLabel(key)),
                    value: r[key] ?? true,
                    onChanged: off
                        ? null
                        : (value) => act(context, () async {
                            await db.from('notification_preferences').upsert({
                              'user_id': backend.uid,
                              key: value,
                            });
                            backend.changed();
                          }),
                  ),
                )
                .toList(),
          );
        },
      ),
    ),
  );
}
