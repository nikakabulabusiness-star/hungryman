import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hungryman_work/core/workspace_config.dart';
import 'package:hungryman_work/main.dart' as app;

void main() {
  test('startup configuration rejects server role JWTs', () {
    final payload = base64Url.encode(
      utf8.encode(jsonEncode({'role': 'service_role'})),
    );
    expect(
      () => WorkspaceConfig.parse(
        'https://example.supabase.co',
        'header.$payload.signature',
      ),
      throwsFormatException,
    );
  });
  test('configuration rejects embedded credentials and endpoint paths', () {
    for (final url in [
      'https://user:password@example.supabase.co',
      'https://example.supabase.co/rest/v1',
      'https://example.supabase.co?key=value',
    ]) {
      expect(
        () => WorkspaceConfig.parse(url, 'sb_publishable_test'),
        throwsFormatException,
      );
    }
  });
  testWidgets(
    'damaged saved configuration recovers without opening workspace',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({'backend_config': '{damaged'});
      await app.main();
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Unable to open the saved workspace'),
        findsOneWidget,
      );
      expect(find.text('სამუშაო სივრცის დაკავშირება'), findsOneWidget);
      expect(find.text('Google-ით შესვლა'), findsNothing);
    },
  );
  testWidgets(
    'secret in saved configuration is refused before initialization',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({
        'backend_config': jsonEncode({
          'url': 'https://example.supabase.co',
          'key': 'sb_secret_test',
        }),
      });
      await app.main();
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Unable to open the saved workspace'),
        findsOneWidget,
      );
      expect(find.text('Google-ით შესვლა'), findsNothing);
    },
  );
}
