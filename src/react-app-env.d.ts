/// <reference types="react-scripts" />
import React from "react";

declare module "react" {
    function memo<T extends React.ComponentType<any>>(
        c: T,
        areEqual?: (
            prev: Readonly<React.ComponentProps<T>>,
            next: Readonly<React.ComponentProps<T>>,
        ) => boolean,
    ): T;
}
