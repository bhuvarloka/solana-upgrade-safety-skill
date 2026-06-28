// Borsh layout model for Anchor IDL accounts (spec 0.1.0).
// Borsh is positional, little-endian, fixed-layout, with no struct padding. Account
// data is prefixed by an 8-byte discriminator. Account field layout lives in `types[]`,
// resolved from `accounts[]` by name.

export const DISCRIMINATOR_LEN = 8;

export type IdlType =
  | string
  | { defined: { name: string } | string }
  | { option: IdlType }
  | { vec: IdlType }
  | { array: [IdlType, number] };

export interface IdlField {
  name: string;
  type: IdlType;
}

export type IdlTypeDefKind =
  | { kind: "struct"; fields?: IdlField[] }
  | { kind: "enum"; variants: { name: string; fields?: unknown }[] }
  | { kind: "type"; alias?: IdlType };

export interface IdlTypeDef {
  name: string;
  type: IdlTypeDefKind;
}

export interface IdlInstruction {
  name: string;
  args?: { name: string; type: IdlType }[];
}

export interface Idl {
  accounts?: { name: string; discriminator?: number[] }[];
  types?: IdlTypeDef[];
  instructions?: IdlInstruction[];
  errors?: { code?: number; name: string; msg?: string }[];
  metadata?: { name?: string; spec?: string };
}

export interface FieldLayout {
  name: string;
  type: string; // human-readable type label
  offset: number;
  size?: number; // undefined => variable-length (dynamic)
}

export interface AccountLayout {
  account: string;
  discriminatorLen: number;
  fields: FieldLayout[];
  fixedSize?: number; // undefined => contains a dynamic field
}

const PRIMITIVE_SIZE: Record<string, number> = {
  bool: 1,
  u8: 1,
  i8: 1,
  u16: 2,
  i16: 2,
  u32: 4,
  i32: 4,
  f32: 4,
  u64: 8,
  i64: 8,
  f64: 8,
  u128: 16,
  i128: 16,
  pubkey: 32,
  publicKey: 32, // legacy spelling
};

export function typeLabel(t: IdlType): string {
  if (typeof t === "string") return t;
  if ("defined" in t) return typeof t.defined === "string" ? t.defined : t.defined.name;
  if ("option" in t) return `Option<${typeLabel(t.option)}>`;
  if ("vec" in t) return `Vec<${typeLabel(t.vec)}>`;
  if ("array" in t) return `[${typeLabel(t.array[0])};${t.array[1]}]`;
  return JSON.stringify(t);
}

// Fixed byte size of a type, or undefined if variable-length. `defined` types are
// resolved against the IDL's type table.
function sizeOf(t: IdlType, idl: Idl, seen: Set<string> = new Set()): number | undefined {
  if (typeof t === "string") return PRIMITIVE_SIZE[t]; // string/bytes => undefined (dynamic)
  if ("array" in t) {
    const elem = sizeOf(t.array[0], idl, seen);
    return elem === undefined ? undefined : elem * t.array[1];
  }
  if ("option" in t || "vec" in t) return undefined; // length-prefixed, dynamic
  if ("defined" in t) {
    const name = typeof t.defined === "string" ? t.defined : t.defined.name;
    if (seen.has(name)) return undefined; // recursive type => not fixed
    seen.add(name);
    const size = sizeOfTypeDef(name, idl, seen);
    seen.delete(name); // backtrack: sibling fields of the same type must resolve too
    return size;
  }
  return undefined;
}

function sizeOfTypeDef(name: string, idl: Idl, seen: Set<string>): number | undefined {
  const def = idl.types?.find((d) => d.name === name);
  if (!def) return undefined;
  if (def.type.kind === "struct") {
    let total = 0;
    for (const f of def.type.fields ?? []) {
      const s = sizeOf(f.type, idl, seen);
      if (s === undefined) return undefined;
      total += s;
    }
    return total;
  }
  if (def.type.kind === "enum") {
    // Fieldless enum => 1-byte discriminant. Data-carrying variants are not fixed-size.
    const hasData = def.type.variants.some((v) => v.fields != null);
    return hasData ? undefined : 1;
  }
  if (def.type.kind === "type" && def.type.alias != null) {
    // Type alias (e.g. `type Foo = u64;`) — size is the aliased type's size.
    return sizeOf(def.type.alias, idl, seen);
  }
  return undefined;
}

export function accountLayout(idl: Idl, accountName: string): AccountLayout {
  const acct = idl.accounts?.find((a) => a.name === accountName);
  if (!acct) throw new Error(`account "${accountName}" not found in IDL`);

  const def = idl.types?.find((d) => d.name === accountName);
  if (!def || def.type.kind !== "struct") {
    throw new Error(`account "${accountName}" has no struct type definition`);
  }

  // Anchor accounts always carry an 8-byte discriminator even when the IDL omits it
  // (empty array). Only a non-empty discriminator overrides the default length.
  const discriminatorLen = acct.discriminator?.length || DISCRIMINATOR_LEN;
  const fields: FieldLayout[] = [];
  let offset = discriminatorLen;
  let fixed = true;

  for (const f of def.type.fields ?? []) {
    const size = sizeOf(f.type, idl);
    fields.push({ name: f.name, type: typeLabel(f.type), offset, size });
    if (size === undefined) {
      // Past the first dynamic field, on-disk offsets are unknown.
      fixed = false;
      offset = Number.NaN;
    } else if (fixed) {
      offset += size;
    }
  }

  return {
    account: accountName,
    discriminatorLen,
    fields,
    fixedSize: fixed ? offset : undefined,
  };
}
