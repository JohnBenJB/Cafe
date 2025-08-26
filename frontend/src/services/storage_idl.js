// Storage Canister IDL
// Aligns with src/storage/main.mo
export const idlFactory = ({ IDL }) => {
  // Error variant used by storage canister
  const StorageError = IDL.Variant({
    NotFound: IDL.Null,
    AccessDenied: IDL.Null,
    InvalidOperation: IDL.Null,
    InvalidChunk: IDL.Null,
    FileTooLarge: IDL.Null,
    Other: IDL.Text,
  });

  const FileId = IDL.Nat32;
  const Version = IDL.Nat;
  const Blob = IDL.Vec(IDL.Nat8);

  const ResultFileId = IDL.Variant({ ok: FileId, err: StorageError });
  const ResultVoid = IDL.Variant({ ok: IDL.Null, err: StorageError });
  const ResultBlob = IDL.Variant({ ok: Blob, err: StorageError });
  const ResultFileIdArray = IDL.Variant({
    ok: IDL.Vec(FileId),
    err: StorageError,
  });
  const ResultVersion = IDL.Variant({ ok: Version, err: StorageError });

  const FileMetaView = IDL.Record({
    id: FileId,
    tableId: IDL.Nat,
    name: IDL.Text,
    mime: IDL.Text,
    size: IDL.Nat,
    chunkCount: IDL.Nat,
    headVersion: Version,
    createdAt: IDL.Int,
    updatedAt: IDL.Int,
    owner: IDL.Principal,
    isDeleted: IDL.Bool,
  });
  const ResultFileMetaView = IDL.Variant({
    ok: FileMetaView,
    err: StorageError,
  });

  const FileMetadataUpdateRequest = IDL.Record({
    name: IDL.Opt(IDL.Text),
    mime: IDL.Opt(IDL.Text),
  });

  const ContentChunk = IDL.Record({
    index: IDL.Nat,
    data: Blob,
    size: IDL.Nat,
  });

  return IDL.Service({
    // File listing by table (uses caller principal for auth)
    listFiles: IDL.Func([IDL.Nat], [ResultFileIdArray], ["query"]),
    list_files: IDL.Func([IDL.Nat], [ResultFileIdArray], ["query"]),

    // Get entire file content as blob (uses caller principal for auth)
    getFileContent: IDL.Func([FileId], [ResultBlob], ["query"]),
    get_file: IDL.Func([FileId], [ResultBlob], ["query"]),

    // Get file metadata (uses caller principal for auth)
    getFileMeta: IDL.Func([FileId], [ResultFileMetaView], []),

    // Update file metadata (requires sessionId)
    updateFileMeta: IDL.Func(
      [IDL.Text, FileId, IDL.Opt(IDL.Text), IDL.Opt(IDL.Text)],
      [ResultVoid],
      []
    ),

    // Update a specific chunk (requires sessionId)
    update_chunk: IDL.Func(
      [IDL.Text, FileId, IDL.Nat, Blob],
      [ResultVersion],
      []
    ),

    // Replace entire file content (requires sessionId)
    replace_file_content: IDL.Func(
      [IDL.Text, FileId, IDL.Vec(ContentChunk)],
      [ResultVersion],
      []
    ),

    // Create new file (requires sessionId)
    create_file: IDL.Func(
      [IDL.Text, IDL.Text, IDL.Nat, IDL.Text, IDL.Opt(Blob)],
      [ResultFileId],
      []
    ),

    // Delete file (requires sessionId)
    delete_file: IDL.Func([IDL.Text, FileId], [ResultVoid], []),

    // Restore deleted file (requires sessionId)
    restore_file: IDL.Func([IDL.Text, FileId], [ResultVoid], []),

    // Get specific chunk (uses caller principal for auth)
    getChunk: IDL.Func(
      [FileId, IDL.Nat],
      [IDL.Variant({ ok: ContentChunk, err: StorageError })],
      []
    ),

    // Get all chunks for a file (uses caller principal for auth)
    getAllChunks: IDL.Func(
      [FileId],
      [IDL.Variant({ ok: IDL.Vec(ContentChunk), err: StorageError })],
      []
    ),
  });
};
