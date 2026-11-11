import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hungryman_work/features/setup.dart';
import 'package:hungryman_work/core/ui.dart';

void main() {
  testWidgets('workspace setup rejects server secrets before initialization', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme(Brightness.light),
        home: const SetupPage(adminOnly: false),
      ),
    );
    await tester.enterText(
      find.byType(TextField).at(0),
      'https://example.supabase.co',
    );
    await tester.enterText(
      find.byType(TextField).at(1),
      'sb_secret_do_not_embed',
    );
    await tester.tap(find.text('სამუშაო სივრცის დაკავშირება'));
    await tester.pumpAndSettle();
    expect(find.textContaining('never a secret key'), findsOneWidget);
  });
  testWidgets('workspace setup rejects insecure backend URLs', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme(Brightness.light),
        home: const SetupPage(adminOnly: false),
      ),
    );
    await tester.enterText(find.byType(TextField).at(0), 'http://example.com');
    await tester.enterText(
      find.byType(TextField).at(1),
      'sb_publishable_example',
    );
    await tester.tap(find.text('სამუშაო სივრცის დაკავშირება'));
    await tester.pumpAndSettle();
    expect(find.textContaining('HTTPS'), findsOneWidget);
  });
}
