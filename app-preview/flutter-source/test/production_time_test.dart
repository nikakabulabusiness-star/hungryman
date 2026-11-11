import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hungryman_work/core/production_time.dart';

void main() {
  test('Tbilisi call time persists as UTC across previous-day boundary', () {
    expect(
      productionInstant(
        DateTime(2026, 9, 15),
        const TimeOfDay(hour: 1, minute: 30),
      ),
      DateTime.utc(2026, 9, 14, 21, 30),
    );
  });
  test('offset timestamps display consistently for all devices', () {
    expect(
      productionLabel('2026-09-15T08:00:00+04:00'),
      productionLabel('2026-09-15T04:00:00Z'),
    );
    expect(productionLabel('2026-09-15T04:00:00Z'), contains('08:00'));
  });
  testWidgets(
    'optional deadline can be cleared without entering raw timestamps',
    (tester) async {
      final controller = TextEditingController(text: '2026-09-15T04:00:00Z');
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ProductionDateField(
              controller: controller,
              label: 'Deadline',
            ),
          ),
        ),
      );
      expect(find.textContaining('08:00'), findsOneWidget);
      await tester.tap(find.byTooltip('გასუფთავება'));
      await tester.pump();
      expect(controller.text, isEmpty);
      expect(find.text('არჩევა'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      controller.dispose();
    },
  );
}
