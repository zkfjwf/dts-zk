package utils

import "testing"

// TestAdd 用一个确定性的断言保持 Go 测试链路处于可运行状态。
func TestAdd(t *testing.T) {
	ans := Add(1, 2)

	if ans != 3 {
		t.Errorf("expected: 3, got: %d", ans)
	}
}
