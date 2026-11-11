import 'package:flutter/foundation.dart';
import 'workspace_config.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class SecureSessionStorage extends LocalStorage {
  final String namespace;
  final FlutterSecureStorage storage;
  const SecureSessionStorage(
    this.namespace, {
    this.storage = const FlutterSecureStorage(),
  });
  String get key => 'auth_session:$namespace';
  @override
  Future<void> initialize() async {}
  @override
  Future<bool> hasAccessToken() => storage.containsKey(key: key);
  @override
  Future<String?> accessToken() => storage.read(key: key);
  @override
  Future<void> persistSession(String persistSessionString) =>
      storage.write(key: key, value: persistSessionString);
  @override
  Future<void> removePersistedSession() => storage.delete(key: key);
}

class SecurePkceStorage extends GotrueAsyncStorage {
  final String namespace;
  final storage = const FlutterSecureStorage();
  SecurePkceStorage(this.namespace);
  String scoped(String key) => 'pkce:$namespace:$key';
  @override
  Future<String?> getItem({required String key}) =>
      storage.read(key: scoped(key));
  @override
  Future<void> removeItem({required String key}) =>
      storage.delete(key: scoped(key));
  @override
  Future<void> setItem({required String key, required String value}) =>
      storage.write(key: scoped(key), value: value);
}

Future<void> initializeBackend(String url, String key) async {
  final config = WorkspaceConfig.parse(url, key);
  final namespace = Uri.parse(config.url).host;
  await Supabase.initialize(
    url: config.url,
    publishableKey: config.key,
    authOptions: FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
      localStorage: kIsWeb ? null : SecureSessionStorage(namespace),
      pkceAsyncStorage: kIsWeb ? null : SecurePkceStorage(namespace),
      detectSessionInUriPredicate: (uri) => kIsWeb
          ? uri.origin == Uri.base.origin && uri.path == Uri.base.path
          : uri.scheme == 'ge.hungryman.work' && uri.host == 'login-callback',
    ),
  );
}
