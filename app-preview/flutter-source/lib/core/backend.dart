import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

typedef DbRow = Map<String, dynamic>;
final db = Supabase.instance.client;
const teamChatId = '00000000-0000-0000-0000-000000000001';

class Backend extends ChangeNotifier {
  final _storage = const FlutterSecureStorage();
  RealtimeChannel? _channel;
  Timer? _timer;
  String get uid => db.auth.currentUser!.id;
  Future<void> connect() async {
    _channel = db
        .channel('workspace-$uid')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          callback: (_) {
            _timer?.cancel();
            _timer = Timer(const Duration(milliseconds: 200), notifyListeners);
          },
        )
        .subscribe();
  }

  void changed() => notifyListeners();
  Future<void> disconnect() async {
    _timer?.cancel();
    if (_channel != null) {
      await db.removeChannel(_channel!);
      _channel = null;
    }
    final keys = await _storage.readAll();
    for (final key in keys.keys) {
      if (key.startsWith('cache:') ||
          RegExp(r'^[0-9a-f-]{36}:').hasMatch(key)) {
        await _storage.delete(key: key);
      }
    }
  }

  Future<DataResult> rows(
    String table, {
    Map<String, dynamic> filters = const {},
    String order = 'created_at',
    bool ascending = false,
  }) async {
    final key = 'cache:$uid:$table:${jsonEncode(filters)}:$order:$ascending';
    try {
      dynamic q = db.from(table).select();
      for (final e in filters.entries) {
        q = q.eq(e.key, e.value);
      }
      final data = List<DbRow>.from(
        await q.order(order, ascending: ascending).limit(200),
      );
      if (!kIsWeb) {
        await _storage.write(
          key: key,
          value: jsonEncode({
            'at': DateTime.now().toIso8601String(),
            'rows': data,
          }),
        );
      }
      return DataResult(data, false);
    } on PostgrestException {
      rethrow;
    } catch (_) {
      if (!kIsWeb) {
        final cache = await _storage.read(key: key);
        if (cache != null) {
          final decoded = jsonDecode(cache) as DbRow;
          final at = DateTime.parse(decoded['at'] as String);
          if (DateTime.now().difference(at) < const Duration(hours: 24)) {
            return DataResult(List<DbRow>.from(decoded['rows']), true);
          }
        }
      }
      rethrow;
    }
  }

  Future<void> insert(String table, DbRow row) async {
    await db.from(table).insert(row);
    changed();
  }

  Future<void> update(String table, DbRow row, String id) async {
    await db.from(table).update(row).eq('id', id);
    changed();
  }

  Future<void> rpc(String name, DbRow params) async {
    await db.rpc(name, params: params);
    changed();
  }
}

class DataResult {
  final List<DbRow> rows;
  final bool offline;
  DataResult(this.rows, this.offline);
}

final backend = Backend();
String person(DbRow p) =>
    '${p['first_name'] ?? ''} ${p['last_name'] ?? ''}'.trim();
