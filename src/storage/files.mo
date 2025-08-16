import Types "./types";
import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Nat64 "mo:base/Nat64";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import Bool "mo:base/Bool";
import Option "mo:base/Option";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Error "mo:base/Error";
import Debug "mo:base/Debug";

module {
  // ===== FILE STORAGE MODULE =====
  // Handles file creation, reading, updating, and deletion with chunked storage
  
  // Import types
  public type FileId = Types.FileId;
  public type Version = Types.Version;
  public type ContentChunk = Types.ContentChunk;
  public type FileMeta = Types.FileMeta;
  public type Access = Types.Access;
  public type Role = Types.Role;
  public type Error = Types.Error;
  public type Result<T, E> = Types.Result<T, E>;
  public type Paginated<T> = Types.Paginated<T>;
  
  // ===== INTERNAL DATA STRUCTURES =====
  
  // File storage structure
  public type FileStorage = {
    var meta : FileMeta;
    var access : Access;
    var chunks : HashMap.HashMap<Nat, ContentChunk>;
    var headVersion : Version;
    var isDeleted : Bool;
  };
  
  // // ===== STATE MANAGEMENT =====
  
  // // Global counters
  // public var nextFileId : Nat32 = 0;
  // public var nextVersion : Nat64 = 0;
  
  // // File storage maps
  // public var filesById = HashMap.HashMap<FileId, FileStorage>(0, Nat32.equal, func(x : Nat32) : Nat { Nat32.toNat(x) });
  // public var fileNamesByOwner = HashMap.HashMap<Principal, HashMap.HashMap<Text, FileId>>(0, Principal.equal, Principal.hash);
  
  // // ===== FILE CREATION =====
  
  // // Create a new file with initial content
  // public func createFile(
  //   name : Text,
  //   mime : Text,
  //   owner : Principal,
  //   initialContent : ?Blob
  // ) : Result<FileId, Error> {
    
  //   // Validate input
  //   if (Text.size(name) == 0) {
  //     return #err(#InvalidOperation);
  //   };
    
  //   // Check if owner already has a file with this name
  //   switch (fileNamesByOwner.get(owner)) {
  //     case (?existingFiles) {
  //       if (Option.isSome(existingFiles.get(name))) {
  //         return #err(#InvalidOperation); // Name already exists
  //       };
  //     };
  //     case null { /* First file for this owner */ };
  //   };
    
  //   // Generate new file ID
  //   let fileId = nextFileId;
  //   nextFileId += 1;
    
  //   // Create initial version
  //   let version = nextVersion;
  //   nextVersion += 1;
    
  //   // Initialize chunks if content provided
  //   let chunks = HashMap.HashMap<Nat, ContentChunk>(0, Nat.equal, func(x : Nat) : Nat { x });
  //   var totalSize : Nat = 0;
  //   var chunkCount : Nat = 0;
    
  //   switch (initialContent) {
  //     case (?content) {
  //       if (content.size() > Types.MAX_FILE_SIZE) {
  //         return #err(#FileTooLarge);
  //       };
        
  //       // Split content into chunks
  //       let chunkSize = Types.MAX_CHUNK_SIZE;
  //       var offset : Nat = 0;
  //       var chunkIndex : Nat = 0;
        
  //       while (offset < content.size()) {
  //         let endOffset = Nat.min(offset + chunkSize, content.size());
  //         let chunkData = Blob.fromArray(Array.subArray(Blob.toArray(content), offset, endOffset - offset));
          
  //         let chunk : ContentChunk = {
  //           index = chunkIndex;
  //           data = chunkData;
  //           size = chunkData.size();
  //         };
          
  //         chunks.put(chunkIndex, chunk);
  //         totalSize += chunk.size;
  //         chunkCount += 1;
  //         offset := endOffset;
  //         chunkIndex += 1;
  //       };
  //     };
  //     case null { /* Empty file */ };
  //   };
    
  //   // Create file metadata
  //   let now = Types.now();
  //   let meta : FileMeta = {
  //     id = fileId;
  //     name = name;
  //     mime = mime;
  //     size = totalSize;
  //     chunkCount = chunkCount;
  //     headVersion = version;
  //     createdAt = now;
  //     updatedAt = now;
  //     owner = owner;
  //     isDeleted = false;
  //   };
    
  //   // Create access control
  //   let access : Access = {
  //     owner = owner;
  //     sharedWith = [];
  //     isPublic = false;
  //   };
    
  //   // Store file
  //   let fileStorage : FileStorage = {
  //     meta = meta;
  //     access = access;
  //     chunks = chunks;
  //     headVersion = version;
  //     isDeleted = false;
  //   };
    
  //   filesById.put(fileId, fileStorage);
    
  //   // Update owner's file name index
  //   switch (fileNamesByOwner.get(owner)) {
  //     case (?existingFiles) {
  //       existingFiles.put(name, fileId);
  //     };
  //     case null {
  //       let newFileMap = HashMap.HashMap<Text, FileId>(0, Text.equal, Text.hash);
  //       newFileMap.put(name, fileId);
  //       fileNamesByOwner.put(owner, newFileMap);
  //     };
  //   };
    
  //   #ok(fileId);
  // };
  
  // // ===== FILE READING =====
  
  // // Get file metadata
  // public func getFileMeta(fileId : FileId) : Result<FileMeta, Error> {
  //   switch (filesById.get(fileId)) {
  //     case (?file) {
  //       if (file.isDeleted) {
  //         return #err(#NotFound);
  //       };
  //       #ok(file.meta);
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };
  
  // // Get file access information
  // public func getFileAccess(fileId : FileId) : Result<Access, Error> {
  //   switch (filesById.get(fileId)) {
  //     case (?file) {
  //       if (file.isDeleted) {
  //         return #err(#NotFound);
  //       };
  //       #ok(file.access);
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };
  
  // // Get a specific chunk of file content
  // public func getChunk(fileId : FileId, chunkIndex : Nat) : Result<ContentChunk, Error> {
  //   switch (filesById.get(fileId)) {
  //     case (?file) {
  //       if (file.isDeleted) {
  //         return #err(#NotFound);
  //       };
  //       switch (file.chunks.get(chunkIndex)) {
  //         case (?chunk) { #ok(chunk) };
  //         case null { #err(#NotFound) };
  //       };
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };
  
  // // Get all chunks for a file
  // public func getAllChunks(fileId : FileId) : Result<[ContentChunk], Error> {
  //   switch (filesById.get(fileId)) {
  //     case (?file) {
  //       if (file.isDeleted) {
  //         return #err(#NotFound);
  //       };
        
  //       let chunkArray = Iter.toArray(file.chunks.entries());
  //       let sortedChunks = Array.sort(chunkArray, func(a : (Nat, ContentChunk), b : (Nat, ContentChunk)) : { #less; #equal; #greater } {
  //         if (a.0 < b.0) { #less } else if (a.0 > b.0) { #greater } else { #equal };
  //       });
        
  //       let chunks = Array.map<(Nat, ContentChunk), ContentChunk>(sortedChunks, func(pair) { pair.1 });
  //       #ok(chunks);
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };
  
  // // Get complete file content as blob
  // public func getFileContent(fileId : FileId) : Result<Blob, Error> {
  //   switch (getAllChunks(fileId)) {
  //     case (#ok(chunks)) {
  //       if (chunks.size() == 0) {
  //         return #ok(Blob.fromArray([]));
  //       };
        
  //       // Calculate total size
  //       let totalSize = Types.calculateTotalSize(chunks);
  //       let buffer = Buffer.Buffer<Nat8>(totalSize);
        
  //       // Concatenate all chunks
  //       for (chunk in chunks.vals()) {
  //         let chunkArray = Blob.toArray(chunk.data);
  //         for (byte in chunkArray.vals()) {
  //           buffer.add(byte);
  //         };
  //       };
        
  //       #ok(Blob.fromArray(Buffer.toArray(buffer)));
  //     };
  //     case (#err(error)) { #err(error) };
  //   };
  // };
  
  // // List files for a user (paginated)
  // public func listFiles(
  //   user : Principal,
  //   offset : Nat,
  //   limit : Nat
  // ) : Result<Paginated<FileMeta>, Error> {
    
  //   let userFiles = Buffer.Buffer<FileMeta>(0);
  //   var total : Nat = 0;
    
  //   // Iterate through all files
  //   for ((fileId, file) in filesById.entries()) {
  //     if (not file.isDeleted) {
  //       // Check if user has access
  //       if (Types.canView(user, file.access)) {
  //         total += 1;
  //         if (userFiles.size() < limit and total > offset) {
  //           userFiles.add(file.meta);
  //         };
  //       };
  //     };
  //   };
    
  //   let nextOffset = if (offset + limit < total) { ?(offset + limit) } else { null };
    
  //   #ok({
  //     items = Buffer.toArray(userFiles);
  //     next = nextOffset;
  //     total = total;
  //   });
  // };
  
  // // ===== FILE UPDATING =====
  
  // // Update file metadata
  // public func updateFileMeta(
  //   fileId : FileId,
  //   name : ?Text,
  //   mime : ?Text,
  //   user : Principal
  // ) : Result<(), Error> {
    
  //   switch (filesById.get(fileId)) {
  //     case (?file) {
  //       if (file.isDeleted) {
  //         return #err(#NotFound);
  //       };
        
  //       if (not Types.canEdit(user, file.access)) {
  //         return #err(#AccessDenied);
  //       };
        
  //       // Update name if provided
  //       switch (name) {
  //         case (?newName) {
  //           if (Text.size(newName) == 0) {
  //             return #err(#InvalidOperation);
  //           };
            
  //           // Check for name conflicts
  //           switch (fileNamesByOwner.get(file.meta.owner)) {
  //             case (?existingFiles) {
  //               switch (existingFiles.get(newName)) {
  //                 case (?existingFileId) {
  //                   if (existingFileId != fileId) {
  //                     return #err(#InvalidOperation); // Name already exists
  //                   };
  //                 };
  //                 case null { /* Name is available */ };
  //               };
  //             };
  //             case null { /* No existing files */ };
  //           };
            
  //           // Remove old name from index
  //           switch (fileNamesByOwner.get(file.meta.owner)) {
  //             case (?existingFiles) {
  //               existingFiles.delete(file.meta.name);
  //               existingFiles.put(newName, fileId);
  //             };
  //             case null { /* Shouldn't happen */ };
  //           };
            
  //           file.meta.name := newName;
  //         };
  //         case null { /* Keep existing name */ };
  //       };
        
  //       // Update MIME type if provided
  //       switch (mime) {
  //         case (?newMime) { file.meta.mime := newMime };
  //         case null { /* Keep existing MIME */ };
  //       };
        
  //       file.meta.updatedAt := Types.now();
        
  //       #ok(());
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };
  
  // // Replace file content with new chunks
  // public func replaceFileContent(
  //   fileId : FileId,
  //   newChunks : [ContentChunk],
  //   user : Principal
  // ) : Result<Version, Error> {
    
  //   switch (filesById.get(fileId)) {
  //     case (?file) {
  //       if (file.isDeleted) {
  //         return #err(#NotFound);
  //       };
        
  //       if (not Types.canEdit(user, file.access)) {
  //         return #err(#AccessDenied);
  //       };
        
  //       // Validate chunks
  //       var totalSize : Nat = 0;
  //       for (chunk in newChunks.vals()) {
  //         if (not Types.validateChunk(chunk)) {
  //           return #err(#InvalidChunk);
  //         };
  //         totalSize += chunk.size;
  //       };
        
  //       if (totalSize > Types.MAX_FILE_SIZE) {
  //         return #err(#FileTooLarge);
  //       };
        
  //       // Create new version
  //       let newVersion = nextVersion;
  //       nextVersion += 1;
        
  //       // Replace chunks
  //       let newChunkMap = HashMap.HashMap<Nat, ContentChunk>(0, Nat.equal, func(x : Nat) : Nat { x });
  //       for (chunk in newChunks.vals()) {
  //         newChunkMap.put(chunk.index, chunk);
  //       };
        
  //       file.chunks := newChunkMap;
  //       file.headVersion := newVersion;
  //       file.meta.size := totalSize;
  //       file.meta.chunkCount := newChunks.size();
  //       file.meta.updatedAt := Types.now();
        
  //       #ok(newVersion);
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };
  
  // // Update a specific chunk
  // public func updateChunk(
  //   fileId : FileId,
  //   chunkIndex : Nat,
  //   data : Blob,
  //   user : Principal
  // ) : Result<Version, Error> {
    
  //   switch (filesById.get(fileId)) {
  //     case (?file) {
  //       if (file.isDeleted) {
  //         return #err(#NotFound);
  //       };
        
  //       if (not Types.canEdit(user, file.access)) {
  //         return #err(#AccessDenied);
  //       };
        
  //       // Validate chunk
  //       if (data.size() > Types.MAX_CHUNK_SIZE) {
  //         return #err(#InvalidChunk);
  //       };
        
  //       let chunk : ContentChunk = {
  //         index = chunkIndex;
  //         data = data;
  //         size = data.size();
  //       };
        
  //       // Calculate new total size
  //       let oldChunk = file.chunks.get(chunkIndex);
  //       var sizeDiff : Int = 0;
  //       switch (oldChunk) {
  //         case (?old) { sizeDiff := Int.sub(Int.fromNat(chunk.size), Int.fromNat(old.size)) };
  //         case null { sizeDiff := Int.fromNat(chunk.size) };
  //       };
        
  //       let newTotalSize = Int.add(Int.fromNat(file.meta.size), sizeDiff);
  //       if (newTotalSize > Int.fromNat(Types.MAX_FILE_SIZE)) {
  //         return #err(#FileTooLarge);
  //       };
        
  //       // Create new version
  //       let newVersion = nextVersion;
  //       nextVersion += 1;
        
  //       // Update chunk
  //       file.chunks.put(chunkIndex, chunk);
  //       file.headVersion := newVersion;
  //       file.meta.size := Int.toNat(newTotalSize);
  //       file.meta.updatedAt := Types.now();
        
  //       #ok(newVersion);
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };
  
  // // ===== FILE DELETION =====
  
  // // Soft delete a file
  // public func deleteFile(fileId : FileId, user : Principal) : Result<(), Error> {
  //   switch (filesById.get(fileId)) {
  //     case (?file) {
  //       if (file.isDeleted) {
  //         return #err(#NotFound);
  //       };
        
  //       if (not Types.isOwner(user, file.access)) {
  //         return #err(#AccessDenied);
  //       };
        
  //       file.isDeleted := true;
  //       file.meta.isDeleted := true;
  //       file.meta.updatedAt := Types.now();
        
  //       // Remove from owner's file name index
  //       switch (fileNamesByOwner.get(file.meta.owner)) {
  //         case (?existingFiles) {
  //           existingFiles.delete(file.meta.name);
  //         };
  //         case null { /* Shouldn't happen */ };
  //       };
        
  //       #ok(());
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };
  
  // // Restore a deleted file
  // public func restoreFile(fileId : FileId, user : Principal) : Result<(), Error> {
  //   switch (filesById.get(fileId)) {
  //     case (?file) {
  //       if (not file.isDeleted) {
  //         return #err(#InvalidOperation);
  //       };
        
  //       if (not Types.isOwner(user, file.access)) {
  //         return #err(#AccessDenied);
  //       };
        
  //       file.isDeleted := false;
  //       file.meta.isDeleted := false;
  //       file.meta.updatedAt := Types.now();
        
  //       // Add back to owner's file name index
  //       switch (fileNamesByOwner.get(file.meta.owner)) {
  //         case (?existingFiles) {
  //           existingFiles.put(file.meta.name, fileId);
  //         };
  //         case null {
  //           let newFileMap = HashMap.HashMap<Text, FileId>(0, Text.equal, Text.hash);
  //           newFileMap.put(file.meta.name, fileId);
  //           fileNamesByOwner.put(file.meta.owner, newFileMap);
  //         };
  //       };
        
  //       #ok(());
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };
  
  // // ===== ACCESS CONTROL =====
  
  // // Share file with another user
  // public func shareFile(
  //   fileId : FileId,
  //   targetUser : Principal,
  //   role : Role,
  //   user : Principal
  // ) : Result<(), Error> {
    
  //   switch (filesById.get(fileId)) {
  //     case (?file) {
  //       if (file.isDeleted) {
  //         return #err(#NotFound);
  //       };
        
  //       if (not Types.isOwner(user, file.access)) {
  //         return #err(#AccessDenied);
  //       };
        
  //       // Check if already shared
  //       for ((sharedUser, existingRole) in file.access.sharedWith.vals()) {
  //         if (Principal.equal(sharedUser, targetUser)) {
  //           // Update existing role
  //           let updatedShared = Array.map<(Principal, Role), (Principal, Role)>(
  //             file.access.sharedWith,
  //             func(pair : (Principal, Role)) : (Principal, Role) {
  //               if (Principal.equal(pair.0, targetUser)) {
  //                 (targetUser, role);
  //               } else {
  //                 pair;
  //               };
  //             }
  //           );
  //           file.access.sharedWith := updatedShared;
  //           return #ok(());
  //         };
  //       };
        
  //       // Add new share
  //       let newShared = Array.append(file.access.sharedWith, [(targetUser, role)]);
  //       file.access.sharedWith := newShared;
        
  //       #ok(());
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };
  
  // // Revoke access for a user
  // public func revokeAccess(
  //   fileId : FileId,
  //   targetUser : Principal,
  //   user : Principal
  // ) : Result<(), Error> {
    
  //   switch (filesById.get(fileId)) {
  //     case (?file) {
  //       if (file.isDeleted) {
  //         return #err(#NotFound);
  //       };
        
  //       if (not Types.isOwner(user, file.access)) {
  //         return #err(#AccessDenied);
  //       };
        
  //       // Remove user from shared list
  //       let filteredShared = Array.filter<(Principal, Role)>(
  //         file.access.sharedWith,
  //         func(pair : (Principal, Role)) : Bool {
  //           not Principal.equal(pair.0, targetUser);
  //         }
  //       );
  //       file.access.sharedWith := filteredShared;
        
  //       #ok(());
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };
  
  // // Set public access
  // public func setPublicAccess(
  //   fileId : FileId,
  //   isPublic : Bool,
  //   user : Principal
  // ) : Result<(), Error> {
    
  //   switch (filesById.get(fileId)) {
  //     case (?file) {
  //       if (file.isDeleted) {
  //         return #err(#NotFound);
  //       };
        
  //       if (not Types.isOwner(user, file.access)) {
  //         return #err(#AccessDenied);
  //       };
        
  //       file.access.isPublic := isPublic;
        
  //       #ok(());
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };
  
  // // ===== UTILITY FUNCTIONS =====
  
  // // Check if file exists and user has access
  // public func hasAccess(fileId : FileId, user : Principal, requiredRole : Role) : Bool {
  //   switch (filesById.get(fileId)) {
  //     case (?file) {
  //       if (file.isDeleted) { return false };
  //       Types.hasRole(user, requiredRole, file.access);
  //     };
  //     case null { false };
  //   };
  // };
  
  // // Get file count for a user
  // public func getUserFileCount(user : Principal) : Nat {
  //   var count : Nat = 0;
  //   for ((_, file) in filesById.entries()) {
  //     if (not file.isDeleted and Types.canView(user, file.access)) {
  //       count += 1;
  //     };
  //   };
  //   count;
  // };
  
  // // Get total storage used by a user
  // public func getUserStorageUsed(user : Principal) : Nat {
  //   var total : Nat = 0;
  //   for ((_, file) in filesById.entries()) {
  //     if (not file.isDeleted and Types.isOwner(user, file.access)) {
  //       total += file.meta.size;
  //     };
  //   };
  //   total;
  // };
  
  // // Clean up deleted files (permanent deletion)
  // public func cleanupDeletedFiles() : Nat {
  //   var deletedCount : Nat = 0;
  //   let toDelete = Buffer.Buffer<FileId>(0);
    
  //   for ((fileId, file) in filesById.entries()) {
  //     if (file.isDeleted) {
  //       toDelete.add(fileId);
  //     };
  //   };
    
  //   for (fileId in toDelete.vals()) {
  //     filesById.delete(fileId);
  //     deletedCount += 1;
  //   };
    
  //   deletedCount;
  // };
};


