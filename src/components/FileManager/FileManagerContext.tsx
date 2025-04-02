
import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { FileSystemItem, BreadcrumbItem, FileManagerState } from '@/types/file-manager';
import { getFolderContents, getPathToFolder, initializeFileSystem } from '@/lib/file-manager';

type Action =
  | { type: 'SET_ITEMS'; payload: FileSystemItem[] }
  | { type: 'SET_CURRENT_FOLDER'; payload: string | null }
  | { type: 'SET_PATH'; payload: BreadcrumbItem[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SELECT_ITEM'; payload: string }
  | { type: 'DESELECT_ITEM'; payload: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_VIEW_MODE'; payload: 'grid' | 'list' }
  | { type: 'SET_SORTING'; payload: { field: 'name' | 'created_at' | 'updated_at' | 'size'; direction: 'asc' | 'desc' } }
  | { type: 'ADD_ITEM'; payload: FileSystemItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_ITEM'; payload: FileSystemItem };

type FileManagerContextType = {
  state: FileManagerState;
  dispatch: React.Dispatch<Action>;
  navigateTo: (folderId: string | null) => Promise<void>;
  refreshCurrentFolder: () => Promise<void>;
};

const initialState: FileManagerState = {
  items: [],
  currentFolder: null,
  path: [{ id: 'root', name: 'My Drive' }],
  loading: false,
  error: null,
  selectedItems: [],
  viewMode: 'grid',
  sorting: { field: 'name', direction: 'asc' },
};

const FileManagerContext = createContext<FileManagerContextType | undefined>(undefined);

function fileManagerReducer(state: FileManagerState, action: Action): FileManagerState {
  switch (action.type) {
    case 'SET_ITEMS':
      return { ...state, items: action.payload };
    case 'SET_CURRENT_FOLDER':
      return { ...state, currentFolder: action.payload };
    case 'SET_PATH':
      return { ...state, path: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SELECT_ITEM':
      return { ...state, selectedItems: [...state.selectedItems, action.payload] };
    case 'DESELECT_ITEM':
      return { ...state, selectedItems: state.selectedItems.filter(id => id !== action.payload) };
    case 'CLEAR_SELECTION':
      return { ...state, selectedItems: [] };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'SET_SORTING':
      return { ...state, sorting: action.payload };
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(item => item.id !== action.payload) };
    case 'UPDATE_ITEM':
      return {
        ...state,
        items: state.items.map(item => 
          item.id === action.payload.id ? action.payload : item
        )
      };
    default:
      return state;
  }
}

export const FileManagerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(fileManagerReducer, initialState);

  const navigateTo = async (folderId: string | null) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_SELECTION' });
      
      const [contents, path] = await Promise.all([
        getFolderContents(folderId),
        getPathToFolder(folderId)
      ]);
      
      dispatch({ type: 'SET_ITEMS', payload: contents });
      dispatch({ type: 'SET_CURRENT_FOLDER', payload: folderId });
      dispatch({ type: 'SET_PATH', payload: path });
      dispatch({ type: 'SET_ERROR', payload: null });
    } catch (error: any) {
      console.error("Error navigating to folder:", error);
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to navigate to folder' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const refreshCurrentFolder = async () => {
    return navigateTo(state.currentFolder);
  };

  // Initialize file system on first load
  useEffect(() => {
    async function init() {
      try {
        await initializeFileSystem();
        navigateTo(null); // Navigate to root folder
      } catch (error) {
        console.error("Error initializing file system:", error);
      }
    }
    
    init();
  }, []);

  return (
    <FileManagerContext.Provider value={{ state, dispatch, navigateTo, refreshCurrentFolder }}>
      {children}
    </FileManagerContext.Provider>
  );
};

export const useFileManager = (): FileManagerContextType => {
  const context = useContext(FileManagerContext);
  if (!context) {
    throw new Error('useFileManager must be used within a FileManagerProvider');
  }
  return context;
};
