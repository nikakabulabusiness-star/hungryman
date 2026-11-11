import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

// Production times use Tbilisi (UTC+04:00), independently of device timezone.
DateTime productionTime(DateTime instant) =>
    instant.toUtc().add(const Duration(hours: 4));
DateTime productionInstant(DateTime date, TimeOfDay time) => DateTime.utc(
  date.year,
  date.month,
  date.day,
  time.hour,
  time.minute,
).subtract(const Duration(hours: 4));
String productionLabel(String value) => DateFormat(
  'dd.MM.yyyy · HH:mm',
).format(productionTime(DateTime.parse(value)));

class ProductionDateField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final bool dateOnly;
  final bool enabled;
  const ProductionDateField({
    required this.controller,
    required this.label,
    this.dateOnly = false,
    this.enabled = true,
    super.key,
  });

  Future<void> pick(BuildContext context) async {
    final parsed = DateTime.tryParse(controller.text);
    final current = parsed == null
        ? productionTime(DateTime.now())
        : dateOnly
        ? parsed
        : productionTime(parsed);
    final date = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(1900),
      lastDate: DateTime(2200),
    );
    if (date == null || !context.mounted) return;
    if (dateOnly) {
      controller.text = DateFormat('yyyy-MM-dd').format(date);
      return;
    }
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: current.hour, minute: current.minute),
    );
    if (time != null) {
      controller.text = productionInstant(date, time).toIso8601String();
    }
  }

  @override
  Widget build(BuildContext context) =>
      ValueListenableBuilder<TextEditingValue>(
        valueListenable: controller,
        builder: (context, value, _) => InputDecorator(
          decoration: InputDecoration(
            labelText: label,
            helperText: dateOnly ? null : 'თბილისი · UTC+04:00',
          ),
          child: Row(
            children: [
              Expanded(
                child: TextButton.icon(
                  onPressed: enabled ? () => pick(context) : null,
                  icon: Icon(dateOnly ? Icons.calendar_month : Icons.schedule),
                  label: Text(
                    value.text.isEmpty
                        ? 'არჩევა'
                        : dateOnly
                        ? value.text
                        : productionLabel(value.text),
                  ),
                ),
              ),
              if (value.text.isNotEmpty)
                IconButton(
                  tooltip: 'გასუფთავება',
                  onPressed: enabled ? controller.clear : null,
                  icon: const Icon(Icons.close),
                ),
            ],
          ),
        ),
      );
}
