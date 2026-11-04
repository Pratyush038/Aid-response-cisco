import 'dart:async';
import 'dart:convert';
import 'dart:io';

class SseEvent {
  final String event;
  final String data;

  SseEvent({required this.event, required this.data});

  @override
  String toString() => 'SseEvent(event: $event, data: $data)';
}

class SseService {
  final String baseUrl;
  StreamController<SseEvent>? _streamController;
  HttpClient? _client;
  HttpClientRequest? _request;
  HttpClientResponse? _response;
  bool _isDisposed = false;
  Timer? _reconnectTimer;

  SseService({required this.baseUrl});

  Stream<SseEvent> get eventStream {
    _streamController ??= StreamController<SseEvent>.broadcast(
      onListen: _connect,
      onCancel: _disconnect,
    );
    return _streamController!.stream;
  }

  void _connect() async {
    if (_isDisposed) return;
    
    try {
      _client = HttpClient();
      _client!.connectionTimeout = const Duration(seconds: 10);
      
      final cleanUrl = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl;
      final uri = Uri.parse('$cleanUrl/api/events');
      
      _request = await _client!.getUrl(uri);
      
      // Set headers to listen to standard server-sent events stream
      _request!.headers.set(HttpHeaders.acceptHeader, 'text/event-stream');
      _request!.headers.set(HttpHeaders.cacheControlHeader, 'no-cache');
      _request!.headers.set(HttpHeaders.connectionHeader, 'keep-alive');
      
      _response = await _request!.close();
      
      if (_response!.statusCode == 200) {
        String currentEvent = 'message';
        StringBuffer dataBuffer = StringBuffer();

        _response!
            .transform(utf8.decoder)
            .transform(const LineSplitter())
            .listen(
          (line) {
            final trimmedLine = line.trim();
            if (trimmedLine.isEmpty) {
              // Frame end: dispatch the gathered event if we have data
              if (dataBuffer.isNotEmpty) {
                if (_streamController != null && !_streamController!.isClosed) {
                  _streamController!.add(
                    SseEvent(event: currentEvent, data: dataBuffer.toString()),
                  );
                }
                dataBuffer.clear();
                currentEvent = 'message'; // Reset default
              }
              return;
            }

            if (trimmedLine.startsWith('event:')) {
              currentEvent = trimmedLine.substring(6).trim();
            } else if (trimmedLine.startsWith('data:')) {
              dataBuffer.write(trimmedLine.substring(5).trim());
            } else if (trimmedLine.startsWith(':')) {
              // Heartbeat comment ping from backend events.ts
            }
          },
          onError: (err) {
            _handleError('SSE Stream error: $err');
          },
          onDone: () {
            _handleError('SSE Stream closed by server');
          },
          cancelOnError: true,
        );
      } else {
        _handleError('SSE Connection failed with HTTP code: ${_response!.statusCode}');
      }
    } catch (e) {
      _handleError('SSE Connection catch: $e');
    }
  }

  void _handleError(String detail) {
    if (_isDisposed) return;
    _disconnect();
    
    // Auto-retry connection after 5 seconds to support server resets
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      if (_streamController != null && _streamController!.hasListener) {
        _connect();
      }
    });
  }

  void _disconnect() {
    _reconnectTimer?.cancel();
    _request?.abort();
    _client?.close(force: true);
    _client = null;
    _request = null;
    _response = null;
  }

  void dispose() {
    _isDisposed = true;
    _disconnect();
    _streamController?.close();
    _streamController = null;
  }
}
