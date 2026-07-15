export interface EmscriptenCoreModule {
  readonly HEAPU8: Uint8Array;
  _malloc(bytes: number): number;
  _free(pointer: number): void;
  _bs_core_create(bytes: number, length: number): number;
  _bs_core_dispatch(handle: number, bytes: number, length: number): number;
  _bs_core_result_length(handle: number): number;
  _bs_core_copy_result(handle: number, output: number, capacity: number): number;
  _bs_core_destroy(handle: number): void;
}

export interface EmscriptenCoreModuleOptions {
  locateFile?(path: string, prefix: string): string;
}

declare function createBrilliantSortCoreModule(
  options?: EmscriptenCoreModuleOptions,
): Promise<EmscriptenCoreModule>;

export default createBrilliantSortCoreModule;
