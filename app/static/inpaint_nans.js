/**
 * inpaint_nans method==0 - JavaScript implementation faithful to MATLAB code.
 *
 * Input:
 *   A2d: 2D array (array of arrays) representing numeric matrix (NaN marks missing)
 * Output:
 *   B2d: 2D array with NaNs replaced (if solvable)
 *
 * Notes:
 * - This implements only method == 0 (the branch from the MATLAB code you provided).
 * - Uses sparse-row representation for fda construction, then forms the smaller
 *   equation matrix M with columns corresponding to nan_list and solves with
 *   normal equations (A^T A x = A^T b) via Gaussian elimination with pivoting.
 * - For 1-D vectors the function follows the 1-D branch in MATLAB.
 */
export function inpaint_nans(A2d) {
  // helpers
  function size(mat) {
    const n = mat.length;
    const m = n > 0 && Array.isArray(mat[0]) ? mat[0].length : 0;
    return [n, m];
  }

  function isNaNval(x) {
    return Number.isNaN(x);
  }

  function flattenColumnMajor(mat) {
    // MATLAB uses column-major linear indexing
    const [n, m] = size(mat);
    const arr = new Array(n * m);
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < n; i++) {
        arr[i + j * n] = mat[i][j];
      }
    }
    return arr;
  }
  function reshapeColumnMajor(vec, n, m) {
    const out = Array.from({ length: n }, () => Array(m).fill(NaN));
    for (let j = 0; j < m; j++) {
      for (let i = 0; i < n; i++) {
        out[i][j] = vec[i + j * n];
      }
    }
    return out;
  }
  function ind2sub(n, m, idx) {
    // idx can be array of 1-based indices (MATLAB). Our idx are 1-based here like MATLAB.
    // Return arrays [rows[], cols[]]
    const rows = [];
    const cols = [];
    for (let t = 0; t < idx.length; t++) {
      const k = idx[t] - 1; // make 0-based
      const col = Math.floor(k / n);
      const row = k - col * n;
      rows.push(row + 1); // back to 1-based
      cols.push(col + 1);
    }
    return [rows, cols];
  }
  function sub2ind(n, m, row, col) {
    // row, col are 1-based, return 1-based linear index
    return row + (col - 1) * n;
  }
  function uniqueSorted(arr) {
    const s = Array.from(new Set(arr));
    s.sort((a, b) => a - b);
    return s;
  }
  function setdiffRows(aRows, bRows) {
    // aRows, bRows are arrays of arrays representing rows [idx,row,col]
    // return rows in aRows that are not present in bRows (compare full row)
    const key = (r) => `${r[0]}_${r[1]}_${r[2]}`;
    const bset = new Set(bRows.map(key));
    return aRows.filter((r) => !bset.has(key(r)));
  }

  // identify_neighbors implementation
  function identify_neighbors(n, m, nan_list_rows, talks_to) {
    // nan_list_rows: array of [linear,row,col] with 1-based indices
    if (nan_list_rows.length === 0) return [];
    const nan_count = nan_list_rows.length;
    const talk_count = talks_to.length;
    const nn = []; // will collect candidate neighbors as [r,c]
    for (let t = 0; t < talk_count; t++) {
      const drow = talks_to[t][0],
        dcol = talks_to[t][1];
      for (let i = 0; i < nan_count; i++) {
        const r = nan_list_rows[i][1] + drow;
        const c = nan_list_rows[i][2] + dcol;
        if (r >= 1 && r <= n && c >= 1 && c <= m) {
          nn.push([r, c]);
        }
      }
    }
    // unique nn rows
    const seen = new Set();
    const uniqueNN = [];
    for (const p of nn) {
      const keyp = `${p[0]}_${p[1]}`;
      if (!seen.has(keyp)) {
        uniqueNN.push(p);
        seen.add(keyp);
      }
    }
    // convert to [linear,row,col]
    const neighbors_list = uniqueNN.map((p) => [
      sub2ind(n, m, p[0], p[1]),
      p[0],
      p[1],
    ]);
    // remove any that are also NaNs
    const result = setdiffRows(neighbors_list, nan_list_rows);
    return result;
  }

  // Gaussian elimination solver for linear system Ax = b (A is NxN dense)
  function solveLinearSystem(A, b) {
    const n = A.length;
    // convert to augmented matrix
    const M = Array.from({ length: n }, (_, i) => A[i].slice());
    const rhs = b.slice();
    const EPS = 1e-12;

    // pivoted Gaussian elimination
    for (let k = 0; k < n; k++) {
      // find pivot
      let piv = k;
      let maxv = Math.abs(M[k][k]);
      for (let i = k + 1; i < n; i++) {
        const av = Math.abs(M[i][k]);
        if (av > maxv) {
          maxv = av;
          piv = i;
        }
      }
      if (maxv < EPS) {
        // singular or nearly singular
        // try to continue (will produce NaN/inf)
      }
      if (piv !== k) {
        [M[k], M[piv]] = [M[piv], M[k]];
        [rhs[k], rhs[piv]] = [rhs[piv], rhs[k]];
      }
      // elimination
      const Akk = M[k][k];
      if (Math.abs(Akk) < EPS) continue;
      for (let i = k + 1; i < n; i++) {
        const factor = M[i][k] / Akk;
        if (factor === 0) continue;
        for (let j = k; j < n; j++) M[i][j] -= factor * M[k][j];
        rhs[i] -= factor * rhs[k];
      }
    }
    // back substitution
    const x = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = rhs[i];
      for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      const diag = M[i][i];
      x[i] = Math.abs(diag) < 1e-12 ? 0 : s / diag;
    }
    return x;
  }

  // Solve least squares for M x = rhs (M: r x c)
  function leastSquaresSolve(M, rhs) {
    // Normal equations: (M^T M) x = M^T rhs
    const r = M.length;
    const c = r > 0 ? M[0].length : 0;
    if (c === 0) return [];
    // compute G = M^T * M (c x c) and v = M^T * rhs (c)
    const G = Array.from({ length: c }, () => Array(c).fill(0));
    const v = Array(c).fill(0);
    for (let i = 0; i < r; i++) {
      const Mi = M[i];
      const ri = rhs[i];
      for (let a = 0; a < c; a++) {
        const Mai = Mi[a];
        if (Mai === 0) continue;
        v[a] += Mai * ri;
        for (let b = a; b < c; b++) {
          G[a][b] += Mai * Mi[b];
        }
      }
    }
    // fill symmetric part
    for (let a = 0; a < c; a++) {
      for (let b = 0; b < a; b++) {
        G[a][b] = G[b][a];
      }
    }
    // solve G x = v (G is c x c)
    return solveLinearSystem(G, v);
  }

  // --- main body ---
  const [n, m] = size(A2d);
  if (n === 0 || m === 0) return A2d; // empty
  // flatten A into column-major vector (length nm)
  const nm = n * m;
  const Aflat = flattenColumnMajor(A2d); // 0-based array, but we'll treat indices 1-based where needed

  // build k=isnan(A(:))
  const kmask = Aflat.map((v) => isNaNval(v));
  const nan_list_indices = []; // 1-based indices of NaNs
  const known_list_indices = [];
  for (let i = 0; i < nm; i++) {
    if (kmask[i]) nan_list_indices.push(i + 1);
    else known_list_indices.push(i + 1);
  }
  const nan_count = nan_list_indices.length;

  // build nan_list rows: [linear, row, col] with 1-based row/col and linear
  const [nr, nc] = ind2sub(n, m, nan_list_indices);
  const nan_list_rows = [];
  for (let t = 0; t < nan_count; t++) {
    nan_list_rows.push([nan_list_indices[t], nr[t], nc[t]]);
  }

  // default method is 0 -> we assume caller wants 0
  // handle case: 1D (vector)
  if (m === 1 || n === 1) {
    // 1D branch - construct work_list
    // in MATLAB work_list = nan_list(:,1); work_list = unique([work_list; work_list - 1; work_list + 1]);
    let wl = nan_list_indices.slice();
    for (const idx of nan_list_indices) {
      wl.push(idx - 1);
      wl.push(idx + 1);
    }
    // keep only 1 < idx < nm (MATLAB code removed <=1 and >=nm)
    wl = wl.filter((x) => x > 1 && x < nm);
    wl.push(...nan_list_indices); // ensure nan indices included
    wl = uniqueSorted(wl);

    const nw = wl.length;
    // Build fda as set of rows (each row represented sparsely as map col->value)
    // For 1D they do: fda = sparse(repmat(u,1,3), bsxfun(@plus, work_list, -1:1), repmat([1 -2 1],nw,1), nw, nm);
    // That means row i corresponds to linear index wl[i], columns wl[i]-1, wl[i], wl[i]+1 with values [1,-2,1]
    const fda_rows = []; // length nw, each row is Map colIndex(1-based) -> value
    for (let i = 0; i < nw; i++) {
      const center = wl[i];
      const rowMap = new Map();
      if (center - 1 >= 1) rowMap.set(center - 1, 1);
      rowMap.set(center, -2);
      if (center + 1 <= nm) rowMap.set(center + 1, 1);
      fda_rows.push({ rowIdx: center, map: rowMap });
    }

    // eliminate knowns: rhs = - fda(:,known_list)*A(known_list)
    // compute rhs for each fda row
    const knownValues = new Map(); // 1-based -> value
    for (const ki of known_list_indices) knownValues.set(ki, Aflat[ki - 1]);

    const rhs = new Array(nw).fill(0);
    for (let i = 0; i < nw; i++) {
      let s = 0;
      for (const [col, val] of fda_rows[i].map.entries()) {
        if (knownValues.has(col)) s += val * knownValues.get(col);
      }
      rhs[i] = -s;
    }

    // Build matrix A_mat rows: columns correspond to nan_list_indices (unknowns)
    const unknowns = nan_list_indices.slice(); // columns we want to solve for
    const N = unknowns.length;
    const A_mat = Array.from({ length: nw }, () => Array(N).fill(0));
    for (let i = 0; i < nw; i++) {
      for (let j = 0; j < N; j++) {
        const uidx = unknowns[j];
        if (fda_rows[i].map.has(uidx)) A_mat[i][j] = fda_rows[i].map.get(uidx);
      }
    }

    // find rows k which have any unknown (same as MATLAB k=find(any(fda(:,nan_list(:,1)),2));)
    const krows = [];
    for (let i = 0; i < nw; i++) {
      let any = false;
      for (let j = 0; j < N; j++)
        if (Math.abs(A_mat[i][j]) > 0) {
          any = true;
          break;
        }
      if (any) krows.push(i);
    }

    // form reduced M and rhs_k
    const M = krows.map((i) => A_mat[i]);
    const rhs_k = krows.map((i) => rhs[i]);

    // solve M x = rhs_k in least squares sense
    const x = leastSquaresSolve(M, rhs_k);

    // fill B (copy Aflat)
    const Bflat = Aflat.slice();
    for (let j = 0; j < N; j++) {
      const idx1 = unknowns[j] - 1;
      Bflat[idx1] = x[j];
    }
    return reshapeColumnMajor(Bflat, n, m);
  }

  // --- 2D case ---
  // talks_to = [-1 0;0 -1;1 0;0 1];
  const talks_to = [
    [-1, 0],
    [0, -1],
    [1, 0],
    [0, 1],
  ];
  const neighbors_list = identify_neighbors(n, m, nan_list_rows, talks_to);

  // all_list = [nan_list; neighbors_list]
  const all_list_rows = nan_list_rows.concat(neighbors_list);

  // generate sparse array with second partials on row variable for each element in either list,
  // but only for those nodes which have a row index > 1 or < n
  // We'll construct fda_rows: for each node in all_list_rows (call it L_i) we create a sparse row map
  const allLen = all_list_rows.length;
  const fda_rows = []; // each element {linear, row, col, map}
  for (let t = 0; t < allLen; t++) {
    const linear = all_list_rows[t][0];
    const row = all_list_rows[t][1];
    const col = all_list_rows[t][2];
    const map = new Map();
    // row second partial: if row > 1 and row < n, neighbors at linear-1,linear,linear+1 with [1 -2 1]
    if (row > 1 && row < n) {
      if (linear - 1 >= 1) map.set(linear - 1, 1);
      map.set(linear, (map.get(linear) || 0) - 2);
      if (linear + 1 <= nm) map.set(linear + 1, (map.get(linear + 1) || 0) + 1);
    } else {
      // if not interior row, leave it — MATLAB does nothing for those rows in this pass
    }
    fda_rows.push({ linear, row, col, map });
  }
  // 2nd partials on column index: for those all_list rows with col >1 and col < m,
  // add entries at linear-n, linear, linear+n with [1 -2 1]
  for (let idx = 0; idx < allLen; idx++) {
    const rec = all_list_rows[idx];
    const linear = rec[0],
      row = rec[1],
      col = rec[2];
    if (col > 1 && col < m) {
      const map = fda_rows[idx].map;
      const a = linear - n;
      const b = linear;
      const c = linear + n;
      map.set(a, (map.get(a) || 0) + 1);
      map.set(b, (map.get(b) || 0) + (map.has(b) ? -2 : -2));
      map.set(c, (map.get(c) || 0) + 1);
    }
  }

  // eliminate knowns: rhs = -fda(:,known_list)*A(known_list)
  const knownVals = new Map();
  for (const ki of known_list_indices) knownVals.set(ki, Aflat[ki - 1]);

  const rhs = new Array(allLen).fill(0);
  for (let i = 0; i < allLen; i++) {
    let s = 0;
    for (const [col, val] of fda_rows[i].map.entries()) {
      if (knownVals.has(col)) s += val * knownVals.get(col);
    }
    rhs[i] = -s;
  }

  // k = find(any(fda(:, nan_list(:,1)),2));
  const unknowns = nan_list_indices.slice(); // columns corresponding to NaN unknowns
  const Nunknown = unknowns.length;

  // Build full small matrix A_mat: allLen x Nunknown
  const A_mat = Array.from({ length: allLen }, () => Array(Nunknown).fill(0));
  // Create a map from unknown linear -> column index
  const unknownIndexMap = new Map();
  for (let j = 0; j < Nunknown; j++) unknownIndexMap.set(unknowns[j], j);

  for (let i = 0; i < allLen; i++) {
    for (const [col, val] of fda_rows[i].map.entries()) {
      if (unknownIndexMap.has(col)) {
        const j = unknownIndexMap.get(col);
        A_mat[i][j] = val;
      }
    }
  }

  // find rows k with any unknown
  const krows = [];
  for (let i = 0; i < allLen; i++) {
    let any = false;
    for (let j = 0; j < Nunknown; j++) {
      if (Math.abs(A_mat[i][j]) > 0) {
        any = true;
        break;
      }
    }
    if (any) krows.push(i);
  }

  // Reduced M and rhs_k
  const M = krows.map((i) => A_mat[i]);
  const rhs_k = krows.map((i) => rhs[i]);

  // Solve least squares M x = rhs_k
  const x = leastSquaresSolve(M, rhs_k);

  // fill B
  const Bflat = Aflat.slice();
  for (let j = 0; j < Nunknown; j++) {
    Bflat[unknowns[j] - 1] = x[j];
  }

  return reshapeColumnMajor(Bflat, n, m);
}
