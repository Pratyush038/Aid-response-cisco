import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/auth_provider.dart';
import '../providers/network_provider.dart';
import '../widgets/route_visualizer.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key});

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  String _selectedRecipient = 'broadcast';
  bool _isSending = false;

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent + 60,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;

    setState(() => _isSending = true);
    _messageController.clear();

    try {
      final networkNotifier = ref.read(networkProvider.notifier);
      
      if (_selectedRecipient == 'broadcast') {
        // Send as a broadcast message to the first online node
        final onlineNodes = ref.read(networkProvider).nodes.where((n) => n.isOnline && n.nodeId != 'user').toList();
        if (onlineNodes.isEmpty) {
          throw Exception('No online nodes available for broadcast propagation');
        }
        await networkNotifier.sendMessage(
          receiverId: onlineNodes.first.nodeId,
          content: text,
          isUser: false,
        );
      } else {
        // Direct Node message.
        // If the recipient role is standard/user, let's treat it as user E2EE.
        final targetNode = ref.read(networkProvider).nodes.firstWhere((n) => n.nodeId == _selectedRecipient);
        final isUserTarget = targetNode.role == 'standard' || targetNode.nodeId != 'cisco-gateway';
        
        await networkNotifier.sendMessage(
          receiverId: _selectedRecipient,
          content: text,
          isUser: isUserTarget,
        );
      }
      
      // Delay slightly to allow state to settle, then scroll
      Future.delayed(const Duration(milliseconds: 100), _scrollToBottom);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to transmit message: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    } finally {
      setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authProvider);
    final network = ref.watch(networkProvider);
    
    final currentUserId = auth.uid ?? 'user';
    final messages = network.messages;
    
    // Filter active nodes for selection (excluding current user)
    final availableNodes = network.nodes.where((n) => n.isOnline && n.nodeId != currentUserId).toList();
    
    // Build a map of node IDs to names for the route visualizer
    final Map<String, String> nodeNames = {
      for (var node in network.nodes) node.nodeId: node.name
    };

    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Auto-scroll when loading completes or new messages are appended
      if (messages.isNotEmpty && !_scrollController.hasClients) {
        _scrollToBottom();
      }
    });

    return Scaffold(
      backgroundColor: const Color(0xFF090D16),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0E131F),
        title: Text(
          'MESH ROUTE MESSAGING',
          style: GoogleFonts.outfit(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.0,
            color: Colors.white,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () async {
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  backgroundColor: const Color(0xFF151B26),
                  title: const Text('Clear Chat Logs?', style: TextStyle(color: Colors.white)),
                  content: const Text('This will clear message logs from the entire simulation database.', style: TextStyle(color: Colors.white70)),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, true), 
                      child: const Text('Clear All', style: TextStyle(color: Colors.redAccent)),
                    ),
                  ],
                ),
              );

              if (confirmed == true) {
                await ref.read(networkProvider.notifier).clearAllMessages();
              }
            },
            child: const Text('Clear Logs', style: TextStyle(color: Colors.white70)),
          ),
        ],
      ),
      body: Column(
        children: [
          // Recipient Selector HUD
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: const Color(0xFF0E131F).withOpacity(0.5),
            child: Row(
              children: [
                const Icon(Icons.hub, color: Color(0xFF007AFF), size: 18),
                const SizedBox(width: 8),
                Text(
                  'Routing Target:',
                  style: GoogleFonts.inter(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: DropdownButton<String>(
                      value: _selectedRecipient,
                      dropdownColor: const Color(0xFF151B26),
                      isExpanded: true,
                      underline: const SizedBox(),
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      icon: const Icon(Icons.arrow_drop_down, color: Colors.white70),
                      onChanged: (val) {
                        if (val != null) setState(() => _selectedRecipient = val);
                      },
                      items: [
                        const DropdownMenuItem(
                          value: 'broadcast',
                          child: Text('📢 Broadcast (Flood Routing)'),
                        ),
                        ...availableNodes.map((node) {
                          String typeLabel = node.role == 'cisco-gateway' ? '☁ Gateway' : '📱 Client';
                          return DropdownMenuItem(
                            value: node.nodeId,
                            child: Text('$typeLabel: ${node.name}'),
                          );
                        }),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Message Stream
          Expanded(
            child: messages.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.forum_outlined, size: 48, color: Colors.white.withOpacity(0.2)),
                        const SizedBox(height: 12),
                        Text(
                          'No mesh messages logged yet.',
                          style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 13),
                        ),
                        Text(
                          'Select a routing target and transmit a packet.',
                          style: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 11),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: messages.length,
                    itemBuilder: (context, index) {
                      final msg = messages[index];
                      final isOutgoing = msg.senderId == currentUserId || msg.senderId == 'user';
                      final isSystem = msg.messageType == 'system';
                      final isSos = msg.messageType == 'sos';
                      
                      final isEncrypted = msg.isEncrypted();
                      final decryptedContent = msg.getDecryptedContent(currentUserId);
                      final isDecryptionFailed = isEncrypted && decryptedContent.endsWith('...');

                      if (isSystem) {
                        return Center(
                          child: Container(
                            margin: const EdgeInsets.symmetric(vertical: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFF9500).withOpacity(0.08),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: const Color(0xFFFF9500).withOpacity(0.25)),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.info_outline, color: Color(0xFFFF9500), size: 14),
                                const SizedBox(width: 6),
                                Flexible(
                                  child: Text(
                                    decryptedContent,
                                    style: GoogleFonts.inter(color: const Color(0xFFFFD59A), fontSize: 11),
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 16.0),
                        child: Column(
                          crossAxisAlignment: isOutgoing ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: isOutgoing ? MainAxisAlignment.end : MainAxisAlignment.start,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (!isOutgoing)
                                  CircleAvatar(
                                    radius: 14,
                                    backgroundColor: isSos ? Colors.redAccent.withOpacity(0.2) : const Color(0xFF007AFF).withOpacity(0.2),
                                    child: Icon(
                                      isSos ? Icons.warning : Icons.person,
                                      size: 14,
                                      color: isSos ? Colors.redAccent : const Color(0xFF007AFF),
                                    ),
                                  ),
                                const SizedBox(width: 8),
                                Column(
                                  crossAxisAlignment: isOutgoing ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                  children: [
                                    // Sender tag
                                    Text(
                                      isOutgoing ? 'You' : (nodeNames[msg.senderId] ?? msg.senderId),
                                      style: TextStyle(
                                        color: Colors.white.withOpacity(0.5),
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const SizedBox(height: 4),

                                    // Bubble Container
                                    Container(
                                      constraints: BoxConstraints(
                                        maxWidth: MediaQuery.of(context).size.width * 0.7,
                                      ),
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(12),
                                        color: isOutgoing
                                            ? const Color(0xFF007AFF).withOpacity(0.85)
                                            : isSos
                                                ? const Color(0xFFFF3B30).withOpacity(0.12)
                                                : const Color(0xFF1E2530),
                                        border: Border.all(
                                          color: isOutgoing
                                              ? const Color(0xFF007AFF).withOpacity(0.5)
                                              : isSos
                                                  ? const Color(0xFFFF3B30).withOpacity(0.3)
                                                  : Colors.white.withOpacity(0.05),
                                        ),
                                      ),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          if (isEncrypted)
                                            Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Icon(
                                                  isDecryptionFailed ? Icons.lock : Icons.lock_open,
                                                  color: isDecryptionFailed ? Colors.redAccent : const Color(0xFF30D158),
                                                  size: 10,
                                                ),
                                                const SizedBox(width: 4),
                                                Text(
                                                  isDecryptionFailed ? 'E2EE Secure (Scrambled)' : 'E2EE Decrypted',
                                                  style: TextStyle(
                                                    color: isDecryptionFailed ? Colors.redAccent : const Color(0xFF30D158),
                                                    fontSize: 8,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          const SizedBox(height: 2),
                                          Text(
                                            decryptedContent,
                                            style: isDecryptionFailed
                                                ? const TextStyle(
                                                    fontFamily: 'monospace',
                                                    color: Colors.white54,
                                                    fontSize: 13,
                                                    fontStyle: FontStyle.italic,
                                                  )
                                                : GoogleFonts.inter(
                                                    color: Colors.white,
                                                    fontSize: 13,
                                                  ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),

                            // Route path visualizer below message bubble
                            if (msg.routingPath.isNotEmpty && msg.routingPath.length > 1)
                              Padding(
                                padding: EdgeInsets.only(
                                  left: isOutgoing ? 0 : 36,
                                  right: isOutgoing ? 12 : 0,
                                ),
                                child: RouteVisualizer(
                                  routingPath: msg.routingPath,
                                  hops: msg.hops,
                                  currentUserId: currentUserId,
                                  nodeNames: nodeNames,
                                ),
                              ),
                          ],
                        ),
                      );
                    },
                    ),
          ),

          // Message Input Bar
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF0E131F),
              border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05))),
            ),
            child: SafeArea(
              top: false,
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.04),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: Colors.white.withOpacity(0.08)),
                          ),
                          child: TextField(
                            controller: _messageController,
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: _selectedRecipient == 'broadcast'
                                  ? 'Broadcast emergency message...'
                                  : 'Type encrypted mesh message...',
                              hintStyle: TextStyle(color: Colors.white.withOpacity(0.3), fontSize: 13),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              border: InputBorder.none,
                            ),
                            onSubmitted: (_) => _sendMessage(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: _isSending ? null : _sendMessage,
                        child: CircleAvatar(
                          radius: 20,
                          backgroundColor: const Color(0xFF007AFF),
                          child: _isSending
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation(Colors.white),
                                  ),
                                )
                              : const Icon(Icons.send, color: Colors.white, size: 18),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.verified_user, color: const Color(0xFF30D158).withOpacity(0.6), size: 10),
                      const SizedBox(width: 4),
                      Text(
                        'Secure Mesh Transmit • End-to-End Encrypted Routing Enabled',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.3),
                          fontSize: 9,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
