import { jest } from '@jest/globals';
import router from '../../src/frontend/js/router.js';
import { FileManager } from '../../src/frontend/js/file.js';

describe('frontend route hash sync', () => {
  let fileManager;
  let replaceStateSpy;

  beforeEach(() => {
    fileManager = FileManager.getInstance();
    fileManager.uiState.selectedRootPath = { id: 'rootA', name: 'rootA', path: '/data/rootA' };
    fileManager.uiState.currentPath = '';
    fileManager.uiState.rootPaths = [fileManager.uiState.selectedRootPath];
    fileManager.rootPaths = [fileManager.uiState.selectedRootPath];
    window.rootPaths = fileManager.rootPaths;
    window.history.replaceState({}, '', 'http://localhost/');
    replaceStateSpy = jest.spyOn(window.history, 'replaceState').mockImplementation(() => {});
  });

  afterEach(() => {
    replaceStateSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('hash から ROOT_PATH と path を復元できる', () => {
    expect(router.getHashRoute('#rootA/folder%2Fchild/file.txt')).toEqual({
      rootPathId: 'rootA',
      path: 'folder/child/file.txt'
    });
  });

  it('現在の ROOT_PATH と path を hash に反映できる', () => {
    fileManager.uiState.currentPath = 'folder/child/file.txt';

    fileManager._syncLocationHash();

    expect(replaceStateSpy).toHaveBeenCalledTimes(1);
    const [, , url] = replaceStateSpy.mock.calls[0];
    expect(String(url)).toContain('#rootA/folder%2Fchild%2Ffile.txt');
    expect(replaceStateSpy.mock.calls[0][0]).toEqual({
      rootPathId: 'rootA',
      path: 'folder/child/file.txt'
    });
  });
});
