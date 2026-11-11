import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:hungryman_work/main_preview.dart' as preview;
import 'package:hungryman_work/features/chat.dart';
import 'package:hungryman_work/features/shoots.dart';
import 'package:hungryman_work/core/backend.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    await Supabase.initialize(url: 'https://preview.invalid', publishableKey: 'preview-public', httpClient: preview.demo,
      authOptions: const FlutterAuthClientOptions(autoRefreshToken: false, detectSessionInUri: false, persistSession: false));
    await Supabase.instance.client.auth.setSession('demo-session');
  });
  tearDownAll(() => Supabase.instance.dispose());
  testWidgets(
    'preview opens existing screens and sends isolated demo message',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(const preview.PreviewApp());
      await tester.runAsync(() async {
        await tester.pump();
        await Future<void>.delayed(const Duration(milliseconds: 500));
      });
      await tester.pumpAndSettle();
      expect(find.textContaining('შემდეგი გადაღება'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(
        MaterialApp(
          home: ChatPage(conversationId: teamChatId, title: 'Demo'),
        ),
      );
      await tester.runAsync(() async {
        await tester.pump();
        await Future<void>.delayed(const Duration(milliseconds: 500));
      });
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Preview test message');
      await tester.tap(find.byIcon(Icons.send));
      await tester.runAsync(() async {
        await tester.pump();
        await Future<void>.delayed(const Duration(milliseconds: 500));
      });
      await tester.pumpAndSettle();
      expect(find.text('Preview test message'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(
        const MaterialApp(
          home: ShootWorkspace(id: preview.shoot, canProduce: true),
        ),
      );
      await tester.runAsync(() async {
        await tester.pump();
        await Future<void>.delayed(const Duration(milliseconds: 500));
      });
      await tester.pumpAndSettle();
      expect(find.textContaining('შეკრების დრო'), findsWidgets);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());

    },
  );
}
