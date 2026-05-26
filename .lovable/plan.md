## 目标
关闭后端的弱密码(HIBP)检测,让 `123456` 这类已泄露密码也能注册。

## 操作
调用 `supabase--configure_auth`,设置:
- `password_hibp_enabled: false`(关闭弱密码检测)
- `disable_signup: false`(保持注册开启)
- `auto_confirm_email`: 保持当前值
- `external_anonymous_users_enabled: false`

## 之后你能做的
用 `D1490` + `123456` 直接注册成功。

## 提示
这会降低账户安全性,仅建议内部/演示场景使用。如果以后想恢复保护,告诉我重新打开即可。