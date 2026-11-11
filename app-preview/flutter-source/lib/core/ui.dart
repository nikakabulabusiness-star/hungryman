import 'package:flutter/material.dart';
import 'backend.dart';
import 'production_time.dart';

const navy = Color(0xFF0B2746), red = Color(0xFFE5202A);
ThemeData appTheme(Brightness b) => ThemeData(
  useMaterial3: true,
  brightness: b,
  visualDensity: const VisualDensity(horizontal: -1, vertical: -1),
  textTheme: const TextTheme(
    bodyLarge: TextStyle(fontSize: 14, height: 1.4),
    bodyMedium: TextStyle(fontSize: 13, height: 1.4),
    titleLarge: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
    titleMedium: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
    titleSmall: TextStyle(fontSize: 13),
  ),
  listTileTheme: const ListTileThemeData(
    dense: true,
    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 2),
    horizontalTitleGap: 10,
    minVerticalPadding: 6,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.all(Radius.circular(22)),
    ),
  ),
  navigationBarTheme: NavigationBarThemeData(
    height: 64,
    indicatorColor: red.withValues(alpha: 0.13),
    labelTextStyle: const WidgetStatePropertyAll(TextStyle(fontSize: 11)),
    iconTheme: const WidgetStatePropertyAll(IconThemeData(size: 21)),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      shape: const StadiumBorder(),
      textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(shape: const StadiumBorder()),
  ),
  chipTheme: const ChipThemeData(
    shape: StadiumBorder(),
    side: BorderSide.none,
    labelStyle: TextStyle(fontSize: 12),
    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
  ),
  bottomSheetTheme: const BottomSheetThemeData(
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
    ),
  ),
  dialogTheme: DialogThemeData(
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
  ),
  colorScheme: ColorScheme.fromSeed(
    seedColor: navy,
    brightness: b,
    primary: red,
    secondary: navy,
  ),
  scaffoldBackgroundColor: b == Brightness.light
      ? const Color(0xFFF5F6F9)
      : const Color(0xFF07121D),
  cardTheme: CardThemeData(
    elevation: 0,
    color: b == Brightness.dark ? const Color(0xFF0C2135) : Colors.white,
    margin: const EdgeInsets.only(bottom: 10),
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
    fillColor: b == Brightness.dark
        ? const Color(0xFF10273D)
        : const Color(0xFFF0F3F7),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(28),
      borderSide: BorderSide.none,
    ),
  ),
  appBarTheme: const AppBarTheme(
    centerTitle: false,
    toolbarHeight: 52,
    scrolledUnderElevation: 0,
  ),
);

class Brand extends StatelessWidget {
  const Brand({super.key});
  @override
  Widget build(BuildContext context) => const Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(Icons.work_rounded, color: red, size: 24),
      SizedBox(width: 10),
      Text(
        'HUNGRYMAN ',
        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
      ),
      Text(
        'WORK',
        style: TextStyle(color: red, fontSize: 16, fontWeight: FontWeight.w900),
      ),
    ],
  );
}

Future<void> act(BuildContext context, Future<void> Function() fn) async {
  try {
    await fn();
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('შენახვა ვერ მოხერხდა. სცადე ხელახლა.')),
      );
    }
  }
}

void go(BuildContext c, Widget page) =>
    Navigator.of(c).push(MaterialPageRoute<void>(builder: (_) => page));

class Empty extends StatelessWidget {
  final String title;
  final IconData icon;
  const Empty(this.title, {this.icon = Icons.inbox_outlined, super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(32),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 44, color: Colors.blueGrey),
        const SizedBox(height: 12),
        Text(title, textAlign: TextAlign.center),
      ],
    ),
  );
}

class LiveData extends StatefulWidget {
  final String table, order;
  final Map<String, dynamic> filters;
  final bool ascending;
  final Widget Function(List<DbRow>, bool) builder;
  const LiveData(
    this.table, {
    required this.builder,
    this.filters = const {},
    this.order = 'created_at',
    this.ascending = false,
    super.key,
  });
  @override
  State<LiveData> createState() => _LiveDataState();
}

class _LiveDataState extends State<LiveData> {
  DataResult? data;
  Object? error;
  bool loading = true;
  int request = 0;
  @override
  void initState() {
    super.initState();
    backend.addListener(refresh);
    refresh();
  }

  @override
  void didUpdateWidget(covariant LiveData old) {
    super.didUpdateWidget(old);
    if (old.table != widget.table ||
        old.filters.toString() != widget.filters.toString() ||
        old.order != widget.order ||
        old.ascending != widget.ascending) {
      refresh();
    }
  }

  Future<void> refresh() async {
    final token = ++request;
    try {
      final d = await backend.rows(
        widget.table,
        filters: widget.filters,
        order: widget.order,
        ascending: widget.ascending,
      );
      if (mounted && token == request) {
        setState(() {
          data = d;
          error = null;
          loading = false;
        });
      }
    } catch (e) {
      if (mounted && token == request) {
        setState(() {
          error = e;
          loading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    backend.removeListener(refresh);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (loading && data == null) {
      return const Center(child: CircularProgressIndicator());
    }
    if (error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Empty('ინფორმაცია ვერ ჩაიტვირთა'),
            TextButton(onPressed: refresh, child: const Text('ხელახლა ცდა')),
          ],
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (data!.offline)
          const MaterialBanner(
            content: Text('კავშირის გარეშე • ბოლო შენახული მონაცემები'),
            actions: [Text('შესანახად დაუკავშირდი ინტერნეტს')],
          ),
        widget.builder(data!.rows, data!.offline),
      ],
    );
  }
}

class Section extends StatelessWidget {
  final String title;
  final Widget child;
  final Widget? action;
  const Section(this.title, {required this.child, this.action, super.key});
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (action != null) action!,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    ),
  );
}

class RecordForm extends StatefulWidget {
  final String title;
  final Map<String, String> fields;
  final DbRow initial;
  final Set<String> dateFields, dateTimeFields;
  final Future<void> Function(DbRow) save;
  const RecordForm({
    required this.title,
    required this.fields,
    required this.save,
    this.initial = const {},
    this.dateFields = const {},
    this.dateTimeFields = const {},
    super.key,
  });
  @override
  State<RecordForm> createState() => _RecordFormState();
}

class _RecordFormState extends State<RecordForm> {
  late final controllers = {
    for (final e in widget.fields.entries)
      e.key: TextEditingController(
        text: widget.initial[e.key]?.toString() ?? '',
      ),
  };
  bool busy = false;
  String? error;
  @override
  void dispose() {
    for (final c in controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.save({
        for (final e in controllers.entries) e.key: e.value.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(
          () => error = 'შენახვა ვერ მოხერხდა. შეამოწმე ველები და კავშირი.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.title)),
    body: Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 680),
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            for (final e in widget.fields.entries)
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child:
                    widget.dateFields.contains(e.key) ||
                        widget.dateTimeFields.contains(e.key)
                    ? ProductionDateField(
                        controller: controllers[e.key]!,
                        label: e.value,
                        dateOnly: widget.dateFields.contains(e.key),
                        enabled: !busy,
                      )
                    : TextField(
                        enabled: !busy,
                        controller: controllers[e.key],
                        maxLines:
                            e.key.contains('description') || e.key == 'body'
                            ? 4
                            : 1,
                        decoration: InputDecoration(labelText: e.value),
                      ),
              ),
            if (error != null) Text(error!, style: const TextStyle(color: red)),
            FilledButton(
              onPressed: busy ? null : submit,
              child: Text(busy ? 'ინახება…' : 'შენახვა'),
            ),
          ],
        ),
      ),
    ),
  );
}

String uiLabel(dynamic value) =>
    const <String, String>{
      'planned': 'დაგეგმილი',
      'confirmed': 'დადასტურებული',
      'cancelled': 'გაუქმებული',
      'completed': 'დასრულებული',
      'draft': 'მონახაზი',
      'pending': 'მოლოდინში',
      'approved': 'დამტკიცებული',
      'disabled': 'გათიშული',
      'going': 'მოვდივარ',
      'maybe': 'შესაძლოა',
      'cant_go': 'ვერ მოვდივარ',
      'not_responded': 'პასუხის გარეშე',
      'todo': 'შესასრულებელი',
      'in_progress': 'მიმდინარე',
      'done': 'დასრულებული',
      'blocked': 'შეჩერებული',
      'owner': 'მფლობელი',
      'admin': 'ადმინისტრატორი',
      'hr': 'კადრები',
      'director': 'რეჟისორი',
      'producer': 'პროდიუსერი',
      'writer': 'სცენარისტი',
      'organizer': 'ორგანიზატორი',
      'camera': 'ოპერატორი',
      'technical': 'ტექნიკური გუნდი',
      'editor': 'მონტაჟის სპეციალისტი',
      'shorts_editor': 'შორთსების მონტაჟი',
      'social': 'სოციალური მედია',
      'content': 'კონტენტის ავტორი',
      'sound_operator': 'ხმის ოპერატორი',
      'sound_director': 'ხმის რეჟისორი',
      'main_chat': 'მთავარი ჩატი',
      'mentions': 'მონიშვნები',
      'shoot_changes': 'გადაღების ცვლილებები',
      'calls': 'ზარები',
      'shoot_start': 'გადაღების დაწყება',
      'lunch': 'შესვენება',
      'estimated_wrap': 'დასრულების დრო',
      'ringing': 'ირეკება',
      'active': 'მიმდინარე',
      'ended': 'დასრულებული',
      'missed': 'გამოტოვებული',
      'declined': 'უარყოფილი',
      'Main': 'მთავარი',
      'Meeting': 'შეკრება',
      'Parking': 'პარკინგი',
      'Lunch': 'შესვენება',
      'Hotel': 'სასტუმრო',
      '1 hour': '1 საათი',
      '8 hours': '8 საათი',
    }[value] ??
    value?.toString() ??
    '';
