// \bpython\b では rg python や mise use python まで拾うので、実行される位置（行頭や ; & | ( ` の直後）にある名前だけを見る。
const RUNTIME =
  /(?:^|[\n;&|(`])\s*(?:(?:do|then|else|env|exec|command|time|nohup)\s+)*(?:\w+=\S*\s+)*(?:\S*\/)?((?:python|pip)[\d.]*|ruby|gem|perl)(?=$|\s)/gu

export const runtimesIn = (command: string) => [
  ...new Set([...command.matchAll(RUNTIME)].map(([, bin = '']) => bin)),
]
