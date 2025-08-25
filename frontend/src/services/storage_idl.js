// Storage Canister IDL
// This is a basic interface definition for the storage canister
// You'll need to update this based on the actual storage canister interface

export const idlFactory = ({ IDL }) => {
  // Debug: Check if IDL is available
  console.log("🔧 IDL Factory called with:", {
    IDL: !!IDL,
    IDLType: typeof IDL,
  });
  if (!IDL) {
    throw new Error("IDL parameter is required for storage IDL factory");
  }

  const FileContent = IDL.Record({
    content: IDL.Text,
    timestamp: IDL.Int,
    user: IDL.Principal,
  });

  const FileMetadata = IDL.Record({
    id: IDL.Nat,
    name: IDL.Text,
    language: IDL.Text,
    size: IDL.Nat,
    lastModified: IDL.Int,
    createdBy: IDL.Principal,
  });

  const StorageResult = IDL.Variant({
    ok: IDL.Text,
    err: IDL.Text,
  });

  const FileResult = IDL.Variant({
    ok: FileContent,
    err: IDL.Text,
  });

  const FileListResult = IDL.Variant({
    ok: IDL.Vec(FileMetadata),
    err: IDL.Text,
  });

  return IDL.Service({
    // Save file content
    save_file: IDL.Func([IDL.Nat, IDL.Nat, IDL.Text], [StorageResult], []),

    // Get file content
    get_file: IDL.Func([IDL.Nat, IDL.Nat], [FileResult], ["query"]),

    // List files in a table
    list_files: IDL.Func([IDL.Nat], [FileListResult], ["query"]),

    // Delete file
    delete_file: IDL.Func([IDL.Nat, IDL.Nat], [StorageResult], []),

    // Get file metadata
    get_file_metadata: IDL.Func(
      [IDL.Nat, IDL.Nat],
      [IDL.Opt(FileMetadata)],
      ["query"]
    ),

    // Update file metadata
    update_file_metadata: IDL.Func(
      [IDL.Nat, IDL.Nat, FileMetadata],
      [StorageResult],
      []
    ),

    // Subscribe to file changes
    subscribe_to_changes: IDL.Func([IDL.Nat], [StorageResult], []),

    // Unsubscribe from changes
    unsubscribe_from_changes: IDL.Func([IDL.Nat], [StorageResult], []),
  });
};
