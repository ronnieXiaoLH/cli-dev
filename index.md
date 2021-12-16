## require 加载资源类型

require 会按照对应的规则解析 .js /.json /.node 格式的文件，对于其他任意类型的文件，都会默认按 js 的规则解析

- js: module.exports / exports.
- json: JSON.parse
- any: .js

## node 多进程

- spawn: 耗时任务(比如 npm install)，需要不断的打印日志
- exec/execFile: 开销比较小的任务
- fork