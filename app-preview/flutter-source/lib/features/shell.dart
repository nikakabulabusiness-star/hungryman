import 'package:flutter/material.dart';
import '../core/backend.dart';
import '../core/ui.dart';
import 'shoots.dart';
import 'team.dart';
import 'chat.dart';
import 'calls.dart';
import 'admin.dart';

class WorkShell extends StatefulWidget {
  final DbRow profile;
  final List<String> roles;
  final bool preview;
  const WorkShell({
    required this.profile,
    required this.roles,
    this.preview = false,
    super.key,
  });
  @override
  State<WorkShell> createState() => _WorkShellState();
}

class _WorkShellState extends State<WorkShell> {
  int tab = 0;
  bool get produce =>
      widget.roles.any(['owner', 'director', 'producer', 'writer'].contains);
  bool get people => widget.roles.any(['owner', 'hr'].contains);
  bool get admin => people || produce || widget.roles.contains('admin');
  @override
  Widget build(BuildContext context) {
    final pages = [
      HomePage(profile: widget.profile, produce: produce),
      const ChatPage(
        conversationId: teamChatId,
        title: 'Hungryman-ის მთავარი ჩატი',
        embedded: true,
      ),
      ShootsPage(canProduce: produce),
      const CallsPage(),
      TeamPage(canManage: people),
    ];
    return Scaffold(
      appBar: AppBar(
        title: const Brand(),
        actions: [
          IconButton(
            onPressed: () => go(context, const NotificationsPage()),
            icon: const Icon(Icons.notifications_outlined),
          ),
          PopupMenuButton<String>(
            onSelected: (s) {
              if (s == 'profile') {
                go(context, ProfilePage(profile: widget.profile));
              }
              if (s == 'admin') {
                go(
                  context,
                  AdminPage(
                    canPeople: people,
                    canProduce: produce,
                    canAudit: widget.roles.any(['owner', 'admin'].contains),
                  ),
                );
              }
              if (s == 'out') {
                act(context, () async {
                  await backend.disconnect();
                  await db.auth.signOut();
                });
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(
                value: 'profile',
                child: Text('ჩემი პროფილი'),
              ),
              if (admin)
                const PopupMenuItem(
                  value: 'admin',
                  child: Text('მართვის პანელი'),
                ),
              if (!widget.preview)
                const PopupMenuItem(value: 'out', child: Text('გასვლა')),
            ],
          ),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, c) => Row(
          children: [
            if (c.maxWidth > 900)
              NavigationRail(
                selectedIndex: tab,
                onDestinationSelected: (v) => setState(() => tab = v),
                labelType: NavigationRailLabelType.all,
                destinations: const [
                  NavigationRailDestination(
                    icon: Icon(Icons.home_outlined),
                    label: Text('მთავარი'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.chat_bubble_outline),
                    label: Text('ჩატი'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.movie_outlined),
                    label: Text('გადაღებები'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.call_outlined),
                    label: Text('ზარები'),
                  ),
                  NavigationRailDestination(
                    icon: Icon(Icons.people_outline),
                    label: Text('გუნდი'),
                  ),
                ],
              ),
            Expanded(child: pages[tab]),
          ],
        ),
      ),
      bottomNavigationBar: MediaQuery.sizeOf(context).width > 900
          ? null
          : NavigationBar(
              selectedIndex: tab,
              onDestinationSelected: (v) => setState(() => tab = v),
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  label: 'მთავარი',
                ),
                NavigationDestination(
                  icon: Icon(Icons.chat_bubble_outline),
                  label: 'ჩატი',
                ),
                NavigationDestination(
                  icon: Icon(Icons.movie_outlined),
                  label: 'გადაღებები',
                ),
                NavigationDestination(
                  icon: Icon(Icons.call_outlined),
                  label: 'ზარები',
                ),
                NavigationDestination(
                  icon: Icon(Icons.people_outline),
                  label: 'გუნდი',
                ),
              ],
            ),
    );
  }
}

class HomePage extends StatelessWidget {
  final DbRow profile;
  final bool produce;
  const HomePage({required this.profile, required this.produce, super.key});
  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      LiveData(
        'shoots',
        order: 'crew_call',
        ascending: true,
        builder: (rows, off) {
          final next = rows
              .where(
                (r) =>
                    DateTime.parse(r['crew_call']).isAfter(DateTime.now()) &&
                    r['status'] != 'cancelled',
              )
              .toList();
          return Section(
            'შემდეგი გადაღება',
            child: next.isEmpty
                ? const Empty('დაგეგმილი გადაღება არ არის')
                : ShootCard(next.first, canProduce: produce),
          );
        },
      ),
      LiveData(
        'pinned_messages',
        filters: const {'conversation_id': teamChatId},
        builder: (rows, off) => Section(
          'აპინული · მთავარი ჩატი',
          child: rows.isEmpty
              ? const Empty('აპინული შეტყობინება არ არის')
              : Column(
                  children: rows
                      .map(
                        (message) => ListTile(
                          leading: const Icon(
                            Icons.push_pin_outlined,
                            color: red,
                          ),
                          title: Text(message['body']),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => go(
                            context,
                            const ChatPage(
                              conversationId: teamChatId,
                              title: 'მთავარი ჩატი',
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
      ),
    ],
  );
}

class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('შეტყობინებები')),
    body: SingleChildScrollView(
      child: LiveData(
        'notifications',
        builder: (rows, off) => rows.isEmpty
            ? const Empty('შეტყობინებები არ არის')
            : Column(
                children: rows
                    .map(
                      (r) => ListTile(
                        leading: Icon(
                          r['read_at'] == null
                              ? Icons.notifications_active
                              : Icons.notifications_none,
                          color: red,
                        ),
                        title: Text(r['title']),
                        subtitle: Text(r['body']),
                        onTap: () => act(context, () async {
                          await backend.update('notifications', {
                            'read_at': DateTime.now().toUtc().toIso8601String(),
                          }, r['id']);
                          if (!context.mounted) return;
                          final path = r['route'] as String;
                          if (path.startsWith('/shoot/')) {
                            go(
                              context,
                              ShootWorkspace(
                                id: path.split('/').last,
                                canProduce: false,
                              ),
                            );
                          }
                        }),
                      ),
                    )
                    .toList(),
              ),
      ),
    ),
  );
}
