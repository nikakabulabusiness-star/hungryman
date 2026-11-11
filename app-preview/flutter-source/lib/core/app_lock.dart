import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

abstract class LockDevice {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<bool> authenticate();
}

class NativeLockDevice implements LockDevice {
  final storage = const FlutterSecureStorage();
  final auth = LocalAuthentication();
  @override
  Future<String?> read(String key) => storage.read(key: key);
  @override
  Future<void> write(String key, String value) =>
      storage.write(key: key, value: value);
  @override
  Future<bool> authenticate() => auth.authenticate(
    localizedReason: 'გახსენი Hungryman Work',
    options: const AuthenticationOptions(stickyAuth: false),
  );
}

class AppLockController extends ChangeNotifier {
  final LockDevice device;
  final bool supported;
  AppLockController(this.device, {this.supported = true});
  String? userId;
  bool enabled = false, locked = false, ready = true, busy = false;
  bool obscured = false;
  String? error;
  int _generation = 0;
  int _backgroundGeneration = 0;

  bool get blocked =>
      userId != null && (!ready || (enabled && (locked || obscured)));
  String get _key => 'app_lock:$userId';

  Future<void> bindUser(String? id) async {
    if (id == userId) return;
    final token = ++_generation;
    userId = id;
    enabled = false;
    locked = false;
    busy = false;
    ready = id == null || !supported;
    error = null;
    notifyListeners();
    if (ready) return;
    try {
      final saved = await device.read(_key);
      if (token != _generation) return;
      enabled = saved == 'true';
      locked = enabled;
      ready = true;
    } catch (_) {
      if (token != _generation) return;
      // Unknown lock preference is never treated as disabled.
      error = 'დაცვის პარამეტრები ვერ ჩაიტვირთა. გადი და სცადე თავიდან.';
    }
    notifyListeners();
  }

  void lifecycle(AppLifecycleState state) {
    obscured = state != AppLifecycleState.resumed;
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden ||
        state == AppLifecycleState.detached) {
      _backgroundGeneration++;
      if (enabled) locked = true;
    }
    notifyListeners();
  }

  Future<void> unlock() async {
    if (busy || !ready || userId == null || !enabled) return;
    final token = _generation, background = _backgroundGeneration;
    busy = true;
    error = null;
    notifyListeners();
    try {
      final authenticated = await device.authenticate();
      if (token != _generation) return;
      if (authenticated && background == _backgroundGeneration) {
        locked = false;
      } else {
        locked = true;
        error = 'ვერ გაიხსნა. სცადე თავიდან ან გადი.';
      }
    } catch (_) {
      if (token == _generation) {
        error = 'მოწყობილობის ავტორიზაცია მიუწვდომელია. სცადე თავიდან ან გადი.';
      }
    } finally {
      if (token == _generation) {
        busy = false;
        notifyListeners();
      }
    }
  }

  Future<void> setEnabled(bool value) async {
    if (!supported || busy || !ready || userId == null || value == enabled) {
      return;
    }
    final token = _generation, background = _backgroundGeneration, key = _key;
    busy = true;
    error = null;
    notifyListeners();
    try {
      if (!await device.authenticate()) {
        throw StateError('ავტორიზაცია გაუქმდა');
      }
      if (token != _generation || background != _backgroundGeneration) return;
      await device.write(key, '$value');
      if (token != _generation) return;
      enabled = value;
      locked = value && background != _backgroundGeneration;
    } catch (_) {
      if (token == _generation) {
        error = 'დაცვა არ შეცვლილა. დაადასტურე ვინაობა და სცადე თავიდან.';
      }
    } finally {
      if (token == _generation) {
        busy = false;
        notifyListeners();
      }
    }
  }
}

final appLock = AppLockController(NativeLockDevice(), supported: !kIsWeb);

/// Sits above the Navigator so pushed chat/file/admin routes are covered too.
class AppLockGate extends StatefulWidget {
  final Widget child;
  final AppLockController controller;
  final Future<void> Function() signOut;
  const AppLockGate({
    required this.child,
    required this.controller,
    required this.signOut,
    super.key,
  });
  @override
  State<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends State<AppLockGate> with WidgetsBindingObserver {
  bool signingOut = false;
  String? signOutError;
  Future<void> signOut() async {
    if (signingOut) return;
    setState(() {
      signingOut = true;
      signOutError = null;
    });
    try {
      await widget.signOut();
    } catch (_) {
      if (mounted) {
        setState(
          () => signOutError =
              'გასვლა ვერ მოხერხდა. შეამოწმე კავშირი და სცადე თავიდან.',
        );
      }
    } finally {
      if (mounted) setState(() => signingOut = false);
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) =>
      widget.controller.lifecycle(state);
  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.controller,
    builder: (context, _) {
      final lock = widget.controller;
      return Stack(
        children: [
          Offstage(
            offstage: lock.blocked,
            child: TickerMode(enabled: !lock.blocked, child: widget.child),
          ),
          if (lock.blocked)
            Positioned.fill(
              child: Material(
                color: const Color(0xFF07121D),
                child: SafeArea(
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(28),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.lock_outline,
                            size: 58,
                            color: Colors.white,
                          ),
                          const SizedBox(height: 20),
                          const Text(
                            'Hungryman Work დაბლოკილია',
                            style: TextStyle(color: Colors.white, fontSize: 22),
                          ),
                          const SizedBox(height: 12),
                          if (lock.error != null)
                            Text(
                              lock.error!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(color: Colors.white70),
                            ),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            onPressed: lock.busy || !lock.ready
                                ? null
                                : lock.unlock,
                            icon: const Icon(Icons.fingerprint),
                            label: Text(lock.busy ? 'მოწმდება…' : 'გახსნა'),
                          ),
                          if (signOutError != null)
                            Text(
                              signOutError!,
                              style: const TextStyle(color: Colors.white70),
                            ),
                          TextButton(
                            onPressed: signingOut ? null : signOut,
                            child: const Text('გასვლა'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      );
    },
  );
}

class AppLockSettings extends StatelessWidget {
  const AppLockSettings({super.key});
  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: appLock,
    builder: (context, _) => Column(
      children: [
        SwitchListTile(
          title: const Text('აპიდან გასვლისას დაბლოკვა'),
          subtitle: const Text(
            'გახსნა Face ID-ით, თითის ანაბეჭდით ან ტელეფონის კოდით.',
          ),
          value: appLock.enabled,
          onChanged: !appLock.supported || appLock.busy
              ? null
              : appLock.setEnabled,
        ),
        if (appLock.error != null)
          Text(
            appLock.error!,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
      ],
    ),
  );
}
