import 'package:flutter_localizations/flutter_localizations.dart';
import 'dart:async';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'features/setup.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/backend.dart';
import 'core/app_lock.dart';
import 'core/session_storage.dart';
import 'core/workspace_config.dart';
import 'core/ui.dart';
import 'features/shell.dart';
import 'features/admin.dart';

Future<void> main() => initializeWork();

Future<void> initializeWork({bool adminOnly = false}) async {
  WidgetsFlutterBinding.ensureInitialized();
  const buildUrl = String.fromEnvironment('SUPABASE_URL');
  const buildKey = String.fromEnvironment('SUPABASE_ANON_KEY');
  String? startupError;
  try {
    WorkspaceConfig? config;
    if (buildUrl.isNotEmpty || buildKey.isNotEmpty) {
      config = WorkspaceConfig.parse(buildUrl, buildKey);
    } else {
      final saved = await const FlutterSecureStorage().read(
        key: 'backend_config',
      );
      if (saved != null) config = WorkspaceConfig.fromSaved(saved);
    }
    if (config != null) {
      await initializeBackend(config.url, config.key);
      runApp(WorkApp(adminOnly: adminOnly));
      return;
    }
  } catch (_) {
    startupError =
        'შენახული სამუშაო სივრცე ვერ გაიხსნა. შეამოწმე კავშირის პარამეტრები.';
  }
  runApp(
    MaterialApp(
      locale: const Locale('ka'),
      supportedLocales: const [Locale('ka')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      debugShowCheckedModeBanner: false,
      theme: appTheme(Brightness.light),
      home: SetupPage(adminOnly: adminOnly, initialError: startupError),
    ),
  );
}

class WorkApp extends StatelessWidget {
  final bool adminOnly;
  const WorkApp({this.adminOnly = false, super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    locale: const Locale('ka'),
    supportedLocales: const [Locale('ka')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    debugShowCheckedModeBanner: false,
    title: 'Hungryman Work',
    theme: appTheme(Brightness.light),
    darkTheme: appTheme(Brightness.dark),
    builder: (context, child) => AppLockGate(
      controller: appLock,
      signOut: () => db.auth.signOut(),
      child: child ?? const SizedBox.shrink(),
    ),
    home: AuthGate(adminOnly: adminOnly),
  );
}

class AuthGate extends StatefulWidget {
  final bool adminOnly;
  const AuthGate({this.adminOnly = false, super.key});
  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  StreamSubscription<AuthState>? auth;
  Timer? poll;
  DbRow? profile;
  List<String> roles = [];
  String? error;
  bool loading = true;
  bool checking = false;
  bool checkAgain = false;
  String? connected;

  @override
  void initState() {
    super.initState();
    auth = db.auth.onAuthStateChange.listen((_) {
      if (appLock.userId != db.auth.currentUser?.id) {
        unawaited(appLock.bindUser(null));
      }
      // Remove the previous account's UI immediately, before any async work.
      if (mounted && profile?['id'] != db.auth.currentUser?.id) {
        setState(() {
          profile = null;
          roles = [];
          loading = true;
        });
      }
      load();
    });
    poll = Timer.periodic(const Duration(seconds: 30), (_) => load());
    load();
  }

  Future<void> load() async {
    if (checking) {
      checkAgain = true;
      return;
    }
    checking = true;
    final user = db.auth.currentUser;
    try {
      if (connected != null && connected != user?.id) {
        await backend.disconnect();
        connected = null;
      }
      if (user == null) {
        if (mounted) {
          setState(() {
            profile = null;
            roles = [];
            loading = false;
            error = null;
          });
        }
        return;
      }
      final p = await db.from('profiles').select().eq('id', user.id).single();
      final r = p['status'] == 'approved'
          ? await db.from('user_roles').select('role_id').eq('user_id', user.id)
          : <DbRow>[];
      if (!mounted || db.auth.currentUser?.id != user.id) return;
      await appLock.bindUser(p['status'] == 'approved' ? user.id : null);
      if (!mounted || db.auth.currentUser?.id != user.id) return;
      if (p['status'] == 'approved' && connected != user.id) {
        await backend.connect();
        connected = user.id;
      } else if (p['status'] != 'approved' && connected != null) {
        await backend.disconnect();
        connected = null;
      }
      if (mounted && db.auth.currentUser?.id == user.id) {
        setState(() {
          profile = p;
          roles = r.map((x) => x['role_id'] as String).toList();
          loading = false;
          error = null;
        });
      }
    } catch (_) {
      if (mounted && db.auth.currentUser?.id == user?.id) {
        setState(() {
          // Fail closed when current access cannot be verified.
          profile = null;
          roles = [];
          error = 'წვდომა ვერ შემოწმდა. შეამოწმე კავშირი და სცადე თავიდან.';
          loading = false;
        });
      }
    } finally {
      checking = false;
      if (checkAgain && mounted) {
        checkAgain = false;
        unawaited(load());
      }
    }
  }

  @override
  void dispose() {
    auth?.cancel();
    poll?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (db.auth.currentUser == null) return const LoginPage();
    if (error != null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(error!, textAlign: TextAlign.center),
              TextButton(onPressed: load, child: const Text('ხელახლა ცდა')),
              TextButton(
                onPressed: () => db.auth.signOut(),
                child: const Text('გასვლა'),
              ),
            ],
          ),
        ),
      );
    }
    if (profile?['status'] != 'approved') {
      return Scaffold(
        appBar: AppBar(
          title: const Brand(),
          actions: [
            TextButton(
              onPressed: () => db.auth.signOut(),
              child: const Text('გასვლა'),
            ),
          ],
        ),
        body: Center(
          child: Empty(
            profile?['status'] == 'disabled'
                ? 'ანგარიში გათიშულია. დაუკავშირდი კადრების სამსახურს.'
                : 'დამტკიცების მოლოდინში\nანგარიშს კადრების სამსახური ან მფლობელი დაამტკიცებს.',
          ),
        ),
      );
    }
    if (kIsWeb || widget.adminOnly) {
      final people = roles.any(['owner', 'hr'].contains);
      final produce = roles.any(
        ['owner', 'director', 'producer', 'writer'].contains,
      );
      final audit = roles.any(['owner', 'admin'].contains);
      if (!people && !produce && !audit) {
        return Scaffold(
          appBar: AppBar(
            title: const Text('Hungryman Work — მართვა'),
            actions: [
              TextButton(
                onPressed: () => db.auth.signOut(),
                child: const Text('გასვლა'),
              ),
            ],
          ),
          body: const Center(child: Empty('საჭიროა ადმინისტრატორის წვდომა.')),
        );
      }
      return AdminPage(canPeople: people, canProduce: produce, canAudit: audit);
    }
    return WorkShell(profile: profile!, roles: roles);
  }
}

class LoginPage extends StatelessWidget {
  const LoginPage({super.key});
  Future<void> login(BuildContext c, OAuthProvider p) => act(c, () async {
    await db.auth.signInWithOAuth(
      p,
      redirectTo: kIsWeb
          ? Uri.base.origin
          : 'ge.hungryman.work://login-callback/',
    );
  });
  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF071725),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 380),
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.work_rounded, color: red, size: 88),
              const SizedBox(height: 28),
              const Text(
                'HUNGRYMAN',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 34,
                ),
              ),
              const Text(
                'WORK',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: red,
                  fontWeight: FontWeight.w900,
                  fontSize: 36,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'ერთი გუნდი\nდიდი ისტორიები',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white70,
                  letterSpacing: 4,
                  height: 1.8,
                ),
              ),
              const SizedBox(height: 64),
              FilledButton(
                onPressed: () => login(context, OAuthProvider.google),
                child: const Text('Google-ით შესვლა'),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                onPressed: () => login(context, OAuthProvider.apple),
                child: const Text(
                  'Apple-ით შესვლა',
                  style: TextStyle(color: Colors.white),
                ),
              ),
              const SizedBox(height: 28),
              const Text(
                'წვდომა Hungryman-ის დამტკიცებული გუნდის წევრებისთვის.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white54),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
