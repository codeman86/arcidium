module.exports = {
  "*.{js,jsx,ts,tsx}": ["eslint --max-warnings=0", "prettier --cache --write"],
  "*.{mjs,cjs,cts,mts,json,md,mdx,css,scss,html}": ["prettier --cache --write"],
};
