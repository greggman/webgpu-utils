export declare type SizeAlign = {
  size: number;
  align: number;
};

// opaque type
export declare interface AST {
  name?: string;
  format?: AST;
};

export declare type Member = {
  name: string;
  offset: number;
  size: number;
  type: AST;
  member: AST;
  isStruct?: boolean;
  isArray: boolean;
  arrayCount: number;
  structSize?: number,
  members?: Member[];
};

export declare type StructInfo = {
  name: string;
  type: string;
  align: number;
  size: number;
  members: Member[];
};

export declare type UniformBufferInfo = StructInfo & {
  group: number;
  binding: number;
};

export declare type Binding = {
  type: "buffer" | "storage" | "texture" | "sampler";
  resource: AST | StructInfo | UniformBufferInfo;
};

export declare class WgslReflect {
  structs: AST[];
  uniforms: AST[];
  storage: AST[];
  textures: AST[];
  samplers: AST[];
  functions: AST[];
  aliases: AST[];
  entry: {
    vertex: AST[];
    fragment: AST[];
    compute: AST[];
  };

  constructor(code: string);
  initialize(code: string): void;

  isTextureVar(node: AST): boolean;
  isSamplerVar(node: AST): boolean;
  isUniformVar(node: AST): boolean;
  isStorageVar(node: AST): boolean;

  getBindGroups(): Binding[][];
  getAttribute(node: AST, name: string);
  getStruct(name: string | AST);
  getAlias(name: string | AST);
  getStorageBufferInfo(node: AST)
  getStructInfo(node: AST);
  getUniformBufferInfo(node: AST)
  getTypeInfo(type: AST): SizeAlign;
}
