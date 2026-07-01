import { describe, expect, it, vi } from 'vitest';

import { AgentDocumentsExecutionRuntime } from './index';

const createRuntime = (overrides = {}) =>
  new AgentDocumentsExecutionRuntime({
    copyDocument: vi.fn(),
    createDocument: vi.fn(),
    createTopicDocument: vi.fn(),
    listDocuments: vi.fn(),
    listTopicDocuments: vi.fn(),
    modifyNodes: vi.fn(),
    readDocument: vi.fn(),
    removeDocument: vi.fn(),
    renameDocument: vi.fn(),
    replaceDocumentContent: vi.fn(),
    updateLoadRule: vi.fn(),
    ...overrides,
  });

describe('AgentDocumentsExecutionRuntime', () => {
  it('returns agentDocumentId and documentId when creating hinted documents', async () => {
    const createDocument = vi.fn().mockResolvedValue({
      documentId: 'backing-doc-1',
      id: 'agent-doc-1',
      title: 'Reusable Procedure',
    });
    const runtime = createRuntime({ createDocument });

    const result = await runtime.createDocument(
      {
        content: 'steps',
        hintIsSkill: true,
        title: 'Reusable Procedure',
      },
      { agentId: 'agent-1' },
    );

    expect(createDocument).toHaveBeenCalledWith({
      agentId: 'agent-1',
      content: 'steps',
      hintIsSkill: true,
      title: 'Reusable Procedure',
    });
    expect(result.state).toMatchObject({
      agentDocumentId: 'agent-doc-1',
      documentId: 'backing-doc-1',
    });
  });

  it('awaits an async document URL builder', async () => {
    const createDocument = vi.fn().mockResolvedValue({
      documentId: 'docs_backing-doc-1',
      id: 'agent-doc-1',
      title: 'Research Notes',
    });
    const runtime = new AgentDocumentsExecutionRuntime(
      {
        copyDocument: vi.fn(),
        createDocument,
        createTopicDocument: vi.fn(),
        listDocuments: vi.fn(),
        listTopicDocuments: vi.fn(),
        modifyNodes: vi.fn(),
        readDocument: vi.fn(),
        removeDocument: vi.fn(),
        renameDocument: vi.fn(),
        replaceDocumentContent: vi.fn(),
        updateLoadRule: vi.fn(),
      },
      {
        getDocumentUrl: async ({ agentId, documentId }) =>
          `https://app.example.com/acme/agent/${agentId}/docs/${documentId}`,
      },
    );

    const result = await runtime.createDocument(
      {
        content: 'notes',
        title: 'Research Notes',
      },
      { agentId: 'agent-1' },
    );

    expect(result.content).toContain(
      'https://app.example.com/acme/agent/agent-1/docs/docs_backing-doc-1',
    );
  });

  it('forwards tool trigger metadata when creating documents with same-turn tool context', async () => {
    const createDocument = vi.fn().mockResolvedValue({
      documentId: 'backing-doc-1',
      id: 'agent-doc-1',
      title: 'Research Notes',
    });
    const runtime = createRuntime({ createDocument });

    await runtime.createDocument(
      {
        content: 'notes',
        title: 'Research Notes',
      },
      {
        agentId: 'agent-1',
        messageId: 'user-msg-1',
        operationId: 'op-client-1',
        threadId: 'thread-1',
        toolCallId: 'call-create-doc-1',
        toolMessageId: 'tool-msg-1',
        topicId: 'topic-1',
      },
    );

    expect(createDocument).toHaveBeenCalledWith({
      agentId: 'agent-1',
      content: 'notes',
      title: 'Research Notes',
      toolContext: {
        messageId: 'user-msg-1',
        operationId: 'op-client-1',
        threadId: 'thread-1',
        toolCallId: 'call-create-doc-1',
        toolMessageId: 'tool-msg-1',
        topicId: 'topic-1',
      },
      trigger: 'tool',
    });
  });

  it('forwards tool trigger metadata when mutating documents with same-turn tool context', async () => {
    const readDocument = vi.fn().mockResolvedValue({
      documentId: 'backing-doc-1',
      id: 'agent-doc-1',
      title: 'Research Notes',
    });
    const renameDocument = vi.fn().mockResolvedValue({
      documentId: 'backing-doc-1',
      id: 'agent-doc-1',
      title: 'Renamed Notes',
    });
    const runtime = createRuntime({ readDocument, renameDocument });

    await runtime.renameDocument(
      {
        id: 'agent-doc-1',
        newTitle: 'Renamed Notes',
      },
      {
        agentId: 'agent-1',
        messageId: 'user-msg-1',
        operationId: 'op-client-1',
        rootOperationId: 'op-root-1',
        threadId: 'thread-1',
        toolCallId: 'call-rename-doc-1',
        toolMessageId: 'tool-msg-rename-1',
        topicId: 'topic-1',
      },
    );

    expect(renameDocument).toHaveBeenCalledWith({
      agentId: 'agent-1',
      id: 'agent-doc-1',
      newTitle: 'Renamed Notes',
      toolContext: {
        messageId: 'user-msg-1',
        operationId: 'op-client-1',
        rootOperationId: 'op-root-1',
        threadId: 'thread-1',
        toolCallId: 'call-rename-doc-1',
        toolMessageId: 'tool-msg-rename-1',
        topicId: 'topic-1',
      },
      trigger: 'tool',
    });
  });

  it('does not forward tool trigger metadata without required attribution ids', async () => {
    const createDocument = vi.fn().mockResolvedValue({
      id: 'agent-doc-1',
      title: 'Draft',
    });
    const runtime = createRuntime({ createDocument });

    await runtime.createDocument(
      {
        content: 'draft',
        title: 'Draft',
      },
      { agentId: 'agent-1', messageId: 'user-msg-1' },
    );

    await runtime.createDocument(
      {
        content: 'draft',
        title: 'Draft',
      },
      { agentId: 'agent-1', toolCallId: 'call-create-doc-1' },
    );

    expect(createDocument).toHaveBeenNthCalledWith(1, {
      agentId: 'agent-1',
      content: 'draft',
      title: 'Draft',
    });
    expect(createDocument).toHaveBeenNthCalledWith(2, {
      agentId: 'agent-1',
      content: 'draft',
      title: 'Draft',
    });
  });
});
