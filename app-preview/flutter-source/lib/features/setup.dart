import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../core/session_storage.dart';
import '../core/workspace_config.dart';
import '../core/ui.dart';
import '../main.dart';

class SetupPage extends StatefulWidget {
  final bool adminOnly;
  final String? initialError;
  const SetupPage({required this.adminOnly, this.initialError, super.key});
  @override
  State<SetupPage> createState() => _SetupPageState();
}

class _SetupPageState extends State<SetupPage> {
  final url = TextEditingController(), key = TextEditingController();
  bool busy = false;
  late String? error = widget.initialError;
  @override
  void dispose() {
    url.dispose();
    key.dispose();
    super.dispose();
  }

  Future<void> connect() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final config = WorkspaceConfig.parse(url.text, key.text);
      await initializeBackend(config.url, config.key);
      await const FlutterSecureStorage().write(
        key: 'backend_config',
        value: jsonEncode({'url': config.url, 'key': config.key}),
      );
      runApp(WorkApp(adminOnly: widget.adminOnly));
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 500),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(24),
          children: [
            const Brand(),
            const SizedBox(height: 28),
            const Text(
              'სამუშაო სივრცის დაკავშირება',
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            const Text(
              'სატესტო ვერსია. დააკავშირე მომზადებული Supabase პროექტი. გუნდის წევრებისთვის კავშირი წინასწარ გამართული იქნება.',
            ),
            const SizedBox(height: 24),
            TextField(
              controller: url,
              decoration: const InputDecoration(
                labelText: 'Supabase-ის პროექტის მისამართი',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: key,
              decoration: const InputDecoration(labelText: 'საჯარო გასაღები'),
            ),
            const SizedBox(height: 20),
            if (error != null) Text(error!, style: const TextStyle(color: red)),
            FilledButton(
              onPressed: busy ? null : connect,
              child: Text(
                busy ? 'უკავშირდება…' : 'სამუშაო სივრცის დაკავშირება',
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
