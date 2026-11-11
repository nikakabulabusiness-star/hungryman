import 'dart:convert';

/// Public client configuration, validated identically for setup and app startup.
class WorkspaceConfig {
  final String url, key;
  const WorkspaceConfig._(this.url, this.key);

  factory WorkspaceConfig.parse(String url, String key) {
    final uri = Uri.tryParse(url.trim());
    final token = key.trim();
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        (uri.path.isNotEmpty && uri.path != '/')) {
      throw const FormatException(
        'ჩაწერე Supabase-ის HTTPS მისამართი, დამატებითი გზისა და პაროლის გარეშე.',
      );
    }
    if (token.startsWith('sb_secret_')) {
      throw const FormatException(
        'გამოიყენე საჯარო გასაღები. საიდუმლო გასაღები დაუშვებელია.',
      );
    }
    if (token.split('.').length == 3) {
      try {
        final payload = jsonDecode(
          utf8.decode(
            base64Url.decode(base64Url.normalize(token.split('.')[1])),
          ),
        );
        if (payload is! Map || payload['role'] != 'anon') {
          throw const FormatException(
            'აპში მხოლოდ საჯარო გასაღები გამოიყენება.',
          );
        }
      } catch (_) {
        throw const FormatException(
          'საჭიროა მოქმედი საჯარო გასაღები.',
        );
      }
    } else if (!token.startsWith('sb_publishable_') ||
        token.length <= 'sb_publishable_'.length) {
      throw const FormatException(
        'ჩაწერე Supabase-ის საჯარო გასაღები.',
      );
    }
    return WorkspaceConfig._(uri.origin, token);
  }

  factory WorkspaceConfig.fromSaved(String saved) {
    final value = jsonDecode(saved);
    if (value is! Map || value['url'] is! String || value['key'] is! String) {
      throw const FormatException('შენახული კავშირის პარამეტრები არასწორია.');
    }
    return WorkspaceConfig.parse(value['url'], value['key']);
  }
}
