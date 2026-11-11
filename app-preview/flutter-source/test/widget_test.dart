import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:hungryman_work/main.dart' as app;

void main() {
  testWidgets('Unconfigured build cannot enter the internal workspace', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues({});
    await app.main();
    await tester.pumpAndSettle();
    expect(find.textContaining('სამუშაო სივრცის დაკავშირება'), findsOneWidget);
    expect(find.text('Google-ით შესვლა'), findsNothing);
  });
}
