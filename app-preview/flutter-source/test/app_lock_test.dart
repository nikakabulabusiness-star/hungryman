import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hungryman_work/core/app_lock.dart';

class FakeDevice implements LockDevice {
  final values = <String, String>{};
  bool allow = true, failRead = false;
  Completer<bool>? pending;
  @override
  Future<String?> read(String key) async {
    if (failRead) throw StateError('Unavailable storage');
    return values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }

  @override
  Future<bool> authenticate() async =>
      pending == null ? allow : await pending!.future;
}

void main() {
  test(
    'lock persists per account and requires authentication to disable',
    () async {
      final device = FakeDevice();
      final lock = AppLockController(device);
      await lock.bindUser('first');
      await lock.setEnabled(true);
      expect(device.values['app_lock:first'], 'true');
      lock.lifecycle(AppLifecycleState.paused);
      lock.lifecycle(AppLifecycleState.resumed);
      expect(lock.blocked, isTrue);
      device.allow = false;
      await lock.unlock();
      expect(lock.blocked, isTrue);
      await lock.setEnabled(false);
      expect(lock.enabled, isTrue);
      device.allow = true;
      await lock.unlock();
      expect(lock.blocked, isFalse);
      await lock.bindUser('second');
      expect(lock.enabled, isFalse);
      await lock.bindUser('first');
      expect(lock.blocked, isTrue);
    },
  );
  test('late authentication cannot unlock a different account', () async {
    final device = FakeDevice()
      ..values.addAll({'app_lock:a': 'true', 'app_lock:b': 'true'});
    final lock = AppLockController(device);
    await lock.bindUser('a');
    device.pending = Completer<bool>();
    final attempt = lock.unlock();
    await lock.bindUser('b');
    device.pending!.complete(true);
    await attempt;
    expect(lock.userId, 'b');
    expect(lock.blocked, isTrue);
  });
  test('backgrounding invalidates an in-progress unlock', () async {
    final device = FakeDevice()..values['app_lock:a'] = 'true';
    final lock = AppLockController(device);
    await lock.bindUser('a');
    device.pending = Completer<bool>();
    final attempt = lock.unlock();
    lock.lifecycle(AppLifecycleState.paused);
    lock.lifecycle(AppLifecycleState.resumed);
    device.pending!.complete(true);
    await attempt;
    expect(lock.blocked, isTrue);
  });
  test('preference read failure stays locked', () async {
    final lock = AppLockController(FakeDevice()..failRead = true);
    await lock.bindUser('a');
    expect(lock.blocked, isTrue);
    expect(lock.ready, isFalse);
  });
  testWidgets('lock covers a route pushed on top of the home screen', (
    tester,
  ) async {
    final device = FakeDevice();
    final lock = AppLockController(device);
    await lock.bindUser('a');
    await lock.setEnabled(true);
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => AppLockGate(
          controller: lock,
          signOut: () => lock.bindUser(null),
          child: child!,
        ),
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const Scaffold(body: Text('PRIVATE MESSAGE')),
                ),
              ),
              child: const Text('Open chat'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open chat'));
    await tester.pumpAndSettle();
    expect(find.text('PRIVATE MESSAGE'), findsOneWidget);
    lock.lifecycle(AppLifecycleState.paused);
    lock.lifecycle(AppLifecycleState.resumed);
    await tester.pump();
    expect(find.text('PRIVATE MESSAGE'), findsNothing);
    expect(find.text('Hungryman Work დაბლოკილია'), findsOneWidget);
    await tester.tap(find.text('გახსნა'));
    await tester.pumpAndSettle();
    expect(find.text('PRIVATE MESSAGE'), findsOneWidget);
  });
}
