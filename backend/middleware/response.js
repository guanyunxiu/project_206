function successHandler(req, res, next) {
  res.success = function(data = null, message = '操作成功', code = 200) {
    res.json({
      code,
      message,
      data,
      timestamp: Date.now()
    })
  }
  next()
}

function errorHandler(err, req, res, next) {
  console.error('Error:', err)
  
  const statusCode = err.statusCode || err.code || 500
  const message = err.message || '服务器内部错误'
  
  res.status(statusCode >= 100 && statusCode < 600 ? statusCode : 500).json({
    code: statusCode,
    message,
    data: null,
    timestamp: Date.now()
  })
}

function notFoundHandler(req, res) {
  res.status(404).json({
    code: 404,
    message: '接口不存在',
    data: null,
    timestamp: Date.now()
  })
}

module.exports = {
  successHandler,
  errorHandler,
  notFoundHandler
}
