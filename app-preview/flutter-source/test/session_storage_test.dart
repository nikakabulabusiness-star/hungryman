import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hungryman_work/core/session_storage.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'secure sessions are project-scoped and logout removes only that session',
    () async {
      FlutterSecureStorage.setMockInitialValues({'app_lock:user': 'true'});
      const a = SecureSessionStorage('first.supabase.co');
      const b = SecureSessionStorage('second.supabase.co');
      await a.persistSession('session-one');
      expect(await a.hasAccessToken(), isTrue);
      expect(await b.accessToken(), isNull);
      await b.persistSession('session-two');
      await a.removePersistedSession();
      expect(await a.hasAccessToken(), isFalse);
      expect(await b.accessToken(), 'session-two');
      expect(
        await const FlutterSecureStorage().read(key: 'app_lock:user'),
        'true',
      );
    },
  );
}
