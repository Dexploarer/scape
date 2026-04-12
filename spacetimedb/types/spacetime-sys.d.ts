declare module "spacetime:sys@2.0" {
    export const moduleHooks: unique symbol;

    export interface ModuleHooks {}

    export interface ModuleDefaultExport {
        [moduleHooks](exports: object): ModuleHooks;
    }
}
