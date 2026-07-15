export interface SnapshotDifference {
  readonly path: string;
  readonly expected: unknown;
  readonly actual: unknown;
}

export function diffSnapshots(expected: unknown, actual: unknown): readonly SnapshotDifference[] {
  const differences: SnapshotDifference[] = [];

  const visit = (left: unknown, right: unknown, path: string): void => {
    if (Object.is(left, right)) {
      return;
    }

    if (Array.isArray(left) && Array.isArray(right)) {
      const length = Math.max(left.length, right.length);
      for (let index = 0; index < length; index += 1) {
        visit(left[index], right[index], `${path}[${index}]`);
      }
      return;
    }

    if (left && right && typeof left === "object" && typeof right === "object") {
      const leftRecord = left as Record<string, unknown>;
      const rightRecord = right as Record<string, unknown>;
      const keys = [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])].sort();
      for (const key of keys) {
        visit(leftRecord[key], rightRecord[key], path ? `${path}.${key}` : key);
      }
      return;
    }

    differences.push({ path: path || "$", expected: left, actual: right });
  };

  visit(expected, actual, "");
  return differences;
}
