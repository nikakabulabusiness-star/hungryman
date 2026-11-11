import 'package:flutter/material.dart';
import '../core/backend.dart';
import '../core/ui.dart';
import 'calls.dart';

class ChatPage extends StatefulWidget {
  final String conversationId, title;
  final String? otherUser;
  final bool embedded;
  const ChatPage({
    required this.conversationId,
    required this.title,
    this.otherUser,
    this.embedded = false,
    super.key,
  });
  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  final input = TextEditingController();
  bool sending = false;
  String? reply;
  String? replyBody;
  @override
  void dispose() {
    input.dispose();
    super.dispose();
  }

  Future<void> send() async {
    final body = input.text.trim();
    if (sending || body.isEmpty) return;
    setState(() => sending = true);
    await act(context, () async {
      await backend.insert('messages', {
        'conversation_id': widget.conversationId,
        'body': body,
        'reply_to': reply,
      });
      input.clear();
      if (mounted) setState(() => reply = null);
    });
    if (mounted) setState(() => sending = false);
  }

  @override
  Widget build(BuildContext context) {
    final body = Column(
      children: [
        if (widget.embedded)
          ListTile(
            title: Text(
              widget.title,
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
        LiveData(
          'pinned_messages',
          filters: {'conversation_id': widget.conversationId},
          builder: (pins, _) => pins.isEmpty
              ? const SizedBox.shrink()
              : ExpansionTile(
                  leading: const Icon(Icons.push_pin, color: red),
                  title: Text('აპინული შეტყობინებები (${pins.length})'),
                  children: pins
                      .map(
                        (pin) => ListTile(
                          title: Text(pin['body']),
                          trailing: IconButton(
                            tooltip: 'აპინვის მოხსნა',
                            icon: const Icon(Icons.close),
                            onPressed: () => act(context, () async {
                              await db
                                  .from('pins')
                                  .delete()
                                  .eq('message_id', pin['id']);
                              backend.changed();
                            }),
                          ),
                        ),
                      )
                      .toList(),
                ),
        ),
        Expanded(
          child: SingleChildScrollView(
            reverse: true,
            padding: const EdgeInsets.all(16),
            child: LiveData(
              'messages',
              filters: {'conversation_id': widget.conversationId},
              builder: (rows, off) => LiveData(
                'profiles',
                order: 'first_name',
                builder: (people, _) => rows.isEmpty
                    ? const Empty('დაიწყე საუბარი')
                    : Column(
                        children: rows.reversed.map((m) {
                          final mine = m['author_id'] == backend.uid;
                          final sender =
                              people
                                  .where((p) => p['id'] == m['author_id'])
                                  .map(person)
                                  .firstOrNull ??
                              'გუნდის წევრი';
                          final bubble = ConstrainedBox(
                            constraints: BoxConstraints(
                              maxWidth: MediaQuery.sizeOf(context).width < 500
                                  ? MediaQuery.sizeOf(context).width * 0.72
                                  : 330,
                            ),
                            child: GestureDetector(
                              onLongPress: () => showModalBottomSheet<void>(
                                context: context,
                                builder: (sheet) => SafeArea(
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      ListTile(
                                        title: const Text('პასუხი'),
                                        onTap: () {
                                          Navigator.pop(sheet);
                                          setState(() {
                                            reply = m['id'];
                                            replyBody = m['body'];
                                          });
                                        },
                                      ),
                                      ListTile(
                                        title: const Text('რეაქცია 👍'),
                                        onTap: () {
                                          Navigator.pop(sheet);
                                          act(context, () async {
                                            await db
                                                .from('message_reactions')
                                                .upsert({
                                                  'message_id': m['id'],
                                                  'user_id': backend.uid,
                                                  'emoji': '👍',
                                                }, ignoreDuplicates: true);
                                            backend.changed();
                                          });
                                        },
                                      ),
                                      ListTile(
                                        title: const Text(
                                          'შეტყობინების აპინვა',
                                        ),
                                        onTap: () {
                                          Navigator.pop(sheet);
                                          act(
                                            context,
                                            () => backend.insert('pins', {
                                              'message_id': m['id'],
                                            }),
                                          );
                                        },
                                      ),
                                      if (mine)
                                        ListTile(
                                          title: const Text('რედაქტირება'),
                                          onTap: () {
                                            Navigator.pop(sheet);
                                            go(
                                              context,
                                              RecordForm(
                                                title:
                                                    'შეტყობინების რედაქტირება',
                                                fields: const {
                                                  'body': 'შეტყობინება',
                                                },
                                                initial: m,
                                                save: (v) => backend.update(
                                                  'messages',
                                                  {
                                                    ...v,
                                                    'edited_at': DateTime.now()
                                                        .toUtc()
                                                        .toIso8601String(),
                                                  },
                                                  m['id'],
                                                ),
                                              ),
                                            );
                                          },
                                        ),
                                      if (mine)
                                        ListTile(
                                          title: const Text('წაშლა'),
                                          onTap: () {
                                            Navigator.pop(sheet);
                                            act(context, () async {
                                              await db
                                                  .from('messages')
                                                  .delete()
                                                  .eq('id', m['id']);
                                              backend.changed();
                                            });
                                          },
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                              child: Container(
                                margin: const EdgeInsets.symmetric(vertical: 3),
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 15,
                                  vertical: 10,
                                ),
                                decoration: BoxDecoration(
                                  color: mine
                                      ? const Color(0xFF154D7C)
                                      : Theme.of(
                                          context,
                                        ).colorScheme.surfaceContainerHighest,
                                  borderRadius: BorderRadius.only(
                                    topLeft: const Radius.circular(24),
                                    topRight: const Radius.circular(24),
                                    bottomLeft: Radius.circular(mine ? 24 : 7),
                                    bottomRight: Radius.circular(mine ? 7 : 24),
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (!mine)
                                      Text(
                                        people
                                                .where(
                                                  (p) =>
                                                      p['id'] == m['author_id'],
                                                )
                                                .map(person)
                                                .firstOrNull ??
                                            'გუნდის წევრი',
                                        style: const TextStyle(
                                          color: Colors.blue,
                                          fontSize: 12,
                                        ),
                                      ),
                                    if (m['reply_to'] != null)
                                      LiveData(
                                        'messages',
                                        filters: {'id': m['reply_to']},
                                        builder: (original, _) => Text(
                                          original.isEmpty
                                              ? 'საწყისი შეტყობინება მიუწვდომელია'
                                              : '↩ ${original.first['body']}',
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            color: mine
                                                ? Colors.white70
                                                : Colors.blueGrey,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                    Text(
                                      m['body'],
                                      style: TextStyle(
                                        color: mine ? Colors.white : null,
                                      ),
                                    ),
                                    if (m['created_at'] != null)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 4),
                                        child: Text(
                                          MaterialLocalizations.of(
                                            context,
                                          ).formatTimeOfDay(
                                            TimeOfDay.fromDateTime(
                                              DateTime.parse(
                                                m['created_at'],
                                              ).toLocal(),
                                            ),
                                          ),
                                          style: TextStyle(
                                            fontSize: 10,
                                            color: mine
                                                ? Colors.white60
                                                : Colors.blueGrey,
                                          ),
                                        ),
                                      ),
                                    MessageReactions(messageId: m['id']),
                                    if (m['edited_at'] != null)
                                      const Text(
                                        'შეცვლილია',
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: Colors.blueGrey,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          );
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                              mainAxisAlignment: mine
                                  ? MainAxisAlignment.end
                                  : MainAxisAlignment.start,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                if (!mine)
                                  Padding(
                                    padding: const EdgeInsets.only(
                                      right: 7,
                                      bottom: 4,
                                    ),
                                    child: CircleAvatar(
                                      radius: 13,
                                      backgroundColor: const Color(0xFF25435F),
                                      child: Text(
                                        sender.isEmpty
                                            ? '?'
                                            : sender.substring(0, 1),
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                  ),
                                Flexible(child: bubble),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
              ),
            ),
          ),
        ),
        if (reply != null)
          ListTile(
            title: const Text('პასუხი შეტყობინებაზე'),
            subtitle: Text(
              replyBody ?? '',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: IconButton(
              onPressed: () => setState(() => reply = null),
              icon: const Icon(Icons.close),
            ),
          ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: input,
                    minLines: 1,
                    maxLines: 5,
                    decoration: const InputDecoration(hintText: 'შეტყობინება…'),
                    onSubmitted: (_) => send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  style: IconButton.styleFrom(backgroundColor: red),
                  onPressed: sending ? null : send,
                  icon: sending
                      ? const CircularProgressIndicator()
                      : const Icon(Icons.send, color: Colors.white, size: 20),
                ),
              ],
            ),
          ),
        ),
      ],
    );
    return widget.embedded
        ? body
        : Scaffold(
            appBar: AppBar(
              title: Text(widget.title),
              actions: widget.otherUser == null
                  ? null
                  : [
                      IconButton(
                        onPressed: () =>
                            startCall(context, [widget.otherUser!], false),
                        icon: const Icon(Icons.call),
                      ),
                      IconButton(
                        onPressed: () =>
                            startCall(context, [widget.otherUser!], true),
                        icon: const Icon(Icons.videocam),
                      ),
                    ],
            ),
            body: body,
          );
  }
}

class MessageReactions extends StatelessWidget {
  final String messageId;
  const MessageReactions({required this.messageId, super.key});
  @override
  Widget build(BuildContext context) => LiveData(
    'message_reactions',
    filters: {'message_id': messageId},
    order: 'emoji',
    builder: (rows, offline) {
      final groups = <String, List<DbRow>>{};
      for (final row in rows) {
        groups.putIfAbsent(row['emoji'] as String, () => []).add(row);
      }
      return Wrap(
        spacing: 6,
        children: groups.entries.map((entry) {
          final mine = entry.value.any((row) => row['user_id'] == backend.uid);
          return FilterChip(
            label: Text('${entry.key} ${entry.value.length}'),
            selected: mine,
            onSelected: offline
                ? null
                : (_) => act(context, () async {
                    if (mine) {
                      await db
                          .from('message_reactions')
                          .delete()
                          .eq('message_id', messageId)
                          .eq('user_id', backend.uid)
                          .eq('emoji', entry.key);
                    } else {
                      await db.from('message_reactions').upsert({
                        'message_id': messageId,
                        'user_id': backend.uid,
                        'emoji': entry.key,
                      }, ignoreDuplicates: true);
                    }
                    backend.changed();
                  }),
          );
        }).toList(),
      );
    },
  );
}
