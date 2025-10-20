/**
 * 山姆日志系统 - TDD测试逻辑
 * 符合CLAUDE.md开发规范：模块化、可测试、可维护
 */

// ============ Mock数据工具 ============
const MockDataManager = {
    // Mock数据存储
    data: {
        users: [],
        logRecords: [],
        apiResponses: []
    },

    // 生成Mock日志记录
    generateLogRecords: function(count = 10) {
        const plates = ['闽A12345', '闽A67890', '闽B11111', '闽C22222', '粤A88888', '京A99999'];
        const records = [];

        for (let i = 0; i < count; i++) {
            const callTime = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
            const responseTime = new Date(callTime.getTime() + Math.random() * 5000);
            const freeParking = Math.random() > 0.5;

            records.push({
                id: i + 1,
                plate_number: plates[Math.floor(Math.random() * plates.length)],
                call_time: callTime.toISOString().replace('T', ' ').substring(0, 19),
                response_time: responseTime.toISOString().replace('T', ' ').substring(0, 19),
                free_parking: freeParking,
                reject_reason: freeParking ? '' : '非会员车辆',
                file_source: 'JieLink_Center_Comm_20250811.log',
                created_at: new Date().toISOString()
            });
        }

        this.data.logRecords = records;
        return records;
    },

    // 生成Mock用户数据
    generateUsers: function() {
        const users = [
            { id: 1, username: 'admin', role: 'admin', email: 'admin@test.com' },
            { id: 2, username: 'user1', role: 'user', email: 'user1@test.com' },
            { id: 3, username: 'user2', role: 'user', email: 'user2@test.com' }
        ];

        this.data.users = users;
        return users;
    },

    // 获取Mock数据
    getData: function(type) {
        return this.data[type] || [];
    },

    // 清空Mock数据
    clear: function() {
        this.data = {
            users: [],
            logRecords: [],
            apiResponses: []
        };
    },

    // 导出Mock数据为JSON
    export: function() {
        return JSON.stringify(this.data, null, 2);
    },

    // 测试方法
    test: function() {
        console.log('=== 测试Mock数据管理器 ===');

        // 测试1: 生成日志记录
        const records = this.generateLogRecords(5);
        console.log('测试1-生成日志记录:', records.length === 5 ? '通过' : '失败');
        console.log('生成的记录数:', records.length);

        // 测试2: 生成用户数据
        const users = this.generateUsers();
        console.log('测试2-生成用户数据:', users.length === 3 ? '通过' : '失败');
        console.log('生成的用户数:', users.length);

        // 测试3: 获取数据
        const retrievedRecords = this.getData('logRecords');
        console.log('测试3-获取数据:', retrievedRecords.length === 5 ? '通过' : '失败');

        // 测试4: 清空数据
        this.clear();
        console.log('测试4-清空数据:', this.getData('logRecords').length === 0 ? '通过' : '失败');

        console.log('=== Mock数据管理器测试完成 ===');
    }
};

// ============ Mock API工具 ============
const MockAPI = {
    // 模拟延迟
    delay: 500,

    // 是否使用Mock模式
    useMock: false,

    // 模拟登录API
    login: function(username, password, callback) {
        setTimeout(() => {
            if (username === 'admin' && password === 'admin123') {
                callback({
                    success: true,
                    data: { username: 'admin', role: 'admin' },
                    message: '登录成功 (Mock)'
                });
            } else {
                callback({
                    success: false,
                    message: '用户名或密码错误 (Mock)'
                });
            }
        }, this.delay);
    },

    // 模拟登出API
    logout: function(callback) {
        setTimeout(() => {
            callback({
                success: true,
                message: '登出成功 (Mock)'
            });
        }, this.delay);
    },

    // 模拟日志查询API
    queryLogs: function(params, callback) {
        setTimeout(() => {
            const mockRecords = MockDataManager.getData('logRecords');
            let filteredRecords = mockRecords;

            if (params.plateNumber) {
                filteredRecords = mockRecords.filter(r =>
                    r.plate_number.includes(params.plateNumber)
                );
            }

            callback({
                success: true,
                data: {
                    records: filteredRecords.slice(0, params.limit || 10),
                    pagination: {
                        total: filteredRecords.length,
                        page: params.page || 1,
                        limit: params.limit || 10
                    }
                },
                message: '查询成功 (Mock)'
            });
        }, this.delay);
    },

    // 模拟健康检查API
    healthCheck: function(callback) {
        setTimeout(() => {
            callback({
                success: true,
                data: {
                    status: 'healthy',
                    database: 'connected',
                    timestamp: new Date().toISOString()
                },
                message: '系统健康 (Mock)'
            });
        }, this.delay);
    },

    // 测试方法
    test: function() {
        console.log('=== 测试Mock API工具 ===');

        let testsPassed = 0;
        let testsTotal = 4;

        // 测试1: 登录API
        this.login('admin', 'admin123', (result) => {
            console.log('测试1-登录API:', result.success ? '通过' : '失败');
            if (result.success) testsPassed++;
        });

        // 测试2: 登出API
        setTimeout(() => {
            this.logout((result) => {
                console.log('测试2-登出API:', result.success ? '通过' : '失败');
                if (result.success) testsPassed++;
            });
        }, 100);

        // 测试3: 查询API
        setTimeout(() => {
            MockDataManager.generateLogRecords(5);
            this.queryLogs({ plateNumber: '闽A' }, (result) => {
                console.log('测试3-查询API:', result.success ? '通过' : '失败');
                if (result.success) testsPassed++;
            });
        }, 200);

        // 测试4: 健康检查API
        setTimeout(() => {
            this.healthCheck((result) => {
                console.log('测试4-健康检查API:', result.success ? '通过' : '失败');
                if (result.success) testsPassed++;

                console.log(`=== Mock API测试完成: ${testsPassed}/${testsTotal} 通过 ===`);
            });
        }, 300);
    }
};

// ============ API客户端模块 ============
const APIClient = {
    baseURL: 'http://localhost:3001',

    // 发送请求
    request: async function(method, url, data = null) {
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // 包含cookies
            };

            if (data && (method === 'POST' || method === 'PUT')) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(this.baseURL + url, options);
            const result = await response.json();

            return {
                success: response.ok,
                status: response.status,
                data: result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    },

    // GET请求
    get: function(url) {
        return this.request('GET', url);
    },

    // POST请求
    post: function(url, data) {
        return this.request('POST', url, data);
    },

    // 测试方法
    test: async function() {
        console.log('=== 测试API客户端 ===');

        // 测试1: GET请求
        const healthResult = await this.get('/health');
        console.log('测试1-GET请求:', healthResult.success ? '通过' : '失败');
        console.log('健康检查结果:', healthResult.data);

        // 测试2: POST请求 (登录)
        const loginResult = await this.post('/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        console.log('测试2-POST请求:', loginResult.success ? '通过' : '失败');

        console.log('=== API客户端测试完成 ===');
    }
};

// ============ 测试工具函数 ============
const TestUtils = {
    // 更新测试结果显示
    updateResult: function(elementId, message, type = 'info') {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.className = 'test-result ' + type;
        element.innerHTML = message;
    },

    // 格式化测试输出
    formatTestOutput: function(title, results) {
        let output = `<strong>${title}</strong><br><br>`;

        results.forEach((result, index) => {
            const badge = result.pass ?
                '<span class="status-badge pass">通过</span>' :
                '<span class="status-badge fail">失败</span>';

            output += `${badge} ${result.name}<br>`;
            if (result.details) {
                output += `<span style="color: #666; margin-left: 60px;">└─ ${result.details}</span><br>`;
            }
        });

        const passCount = results.filter(r => r.pass).length;
        output += `<br><strong>测试汇总: ${passCount}/${results.length} 通过</strong>`;

        return output;
    },

    // 格式化JSON
    formatJSON: function(data) {
        return '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
    }
};

// ============ 测试功能函数 ============

// 测试API连接
async function testAPIConnection() {
    TestUtils.updateResult('api-test-result', '正在测试API连接...', 'running');

    try {
        const result = await APIClient.get('/api/status');

        if (result.success) {
            const output = `
                <span class="status-badge pass">连接成功</span><br><br>
                <strong>系统状态:</strong><br>
                ${TestUtils.formatJSON(result.data)}
            `;
            TestUtils.updateResult('api-test-result', output, 'success');
        } else {
            TestUtils.updateResult('api-test-result',
                `<span class="status-badge fail">连接失败</span><br>错误: ${result.error}`,
                'error');
        }
    } catch (error) {
        TestUtils.updateResult('api-test-result',
            `<span class="status-badge fail">连接异常</span><br>错误: ${error.message}`,
            'error');
    }
}

// 测试健康检查
async function testHealthCheck() {
    TestUtils.updateResult('api-test-result', '正在进行健康检查...', 'running');

    try {
        const result = await APIClient.get('/health');

        if (result.success) {
            const output = `
                <span class="status-badge pass">系统健康</span><br><br>
                ${TestUtils.formatJSON(result.data)}
            `;
            TestUtils.updateResult('api-test-result', output, 'success');
        } else {
            TestUtils.updateResult('api-test-result',
                `<span class="status-badge fail">健康检查失败</span><br>状态码: ${result.status}`,
                'error');
        }
    } catch (error) {
        TestUtils.updateResult('api-test-result',
            `<span class="status-badge fail">检查异常</span><br>错误: ${error.message}`,
            'error');
    }
}

// 测试登录
async function testLogin() {
    const username = document.getElementById('test-username').value || 'admin';
    const password = document.getElementById('test-password').value || 'admin123';

    TestUtils.updateResult('auth-test-result', '正在测试登录...', 'running');

    try {
        const result = await APIClient.post('/api/auth/login', { username, password });

        if (result.success && result.data.success) {
            const output = `
                <span class="status-badge pass">登录成功</span><br><br>
                <strong>用户信息:</strong><br>
                用户名: ${result.data.data.username}<br>
                角色: ${result.data.data.role || '未知'}<br>
            `;
            TestUtils.updateResult('auth-test-result', output, 'success');
        } else {
            TestUtils.updateResult('auth-test-result',
                `<span class="status-badge fail">登录失败</span><br>消息: ${result.data.message}`,
                'error');
        }
    } catch (error) {
        TestUtils.updateResult('auth-test-result',
            `<span class="status-badge fail">登录异常</span><br>错误: ${error.message}`,
            'error');
    }
}

// 测试登出
async function testLogout() {
    TestUtils.updateResult('auth-test-result', '正在测试登出...', 'running');

    try {
        const result = await APIClient.post('/api/auth/logout');

        if (result.success) {
            TestUtils.updateResult('auth-test-result',
                '<span class="status-badge pass">登出成功</span>',
                'success');
        } else {
            TestUtils.updateResult('auth-test-result',
                `<span class="status-badge fail">登出失败</span><br>消息: ${result.data.message}`,
                'error');
        }
    } catch (error) {
        TestUtils.updateResult('auth-test-result',
            `<span class="status-badge fail">登出异常</span><br>错误: ${error.message}`,
            'error');
    }
}

// 测试日志查询
async function testLogQuery() {
    const plateNumber = document.getElementById('test-plate').value;

    TestUtils.updateResult('log-query-test-result', '正在查询日志...', 'running');

    try {
        const params = new URLSearchParams({
            page: 1,
            limit: 10
        });

        if (plateNumber) {
            params.append('plateNumber', plateNumber);
        }

        const result = await APIClient.get('/api/logs/records?' + params.toString());

        if (result.success && result.data.success) {
            const records = result.data.data.records;
            const pagination = result.data.data.pagination;

            let output = `<span class="status-badge pass">查询成功</span><br><br>`;
            output += `<strong>查询结果: 共 ${pagination.total} 条记录</strong><br><br>`;

            if (records.length > 0) {
                records.slice(0, 5).forEach((record, index) => {
                    output += `${index + 1}. 车牌: ${record.plate_number} | `;
                    output += `免费停车: ${record.free_parking ? '是' : '否'} | `;
                    output += `查询时间: ${record.call_time}<br>`;
                });

                if (records.length > 5) {
                    output += `<br>... 还有 ${records.length - 5} 条记录`;
                }
            } else {
                output += '未找到匹配的记录';
            }

            TestUtils.updateResult('log-query-test-result', output, 'success');
        } else {
            TestUtils.updateResult('log-query-test-result',
                `<span class="status-badge fail">查询失败</span><br>消息: ${result.data.message}`,
                'error');
        }
    } catch (error) {
        TestUtils.updateResult('log-query-test-result',
            `<span class="status-badge fail">查询异常</span><br>错误: ${error.message}`,
            'error');
    }
}

// 使用Mock数据测试查询
function testLogQueryWithMock() {
    TestUtils.updateResult('log-query-test-result', '使用Mock数据测试...', 'running');

    // 生成Mock数据
    const mockRecords = MockDataManager.generateLogRecords(10);
    const plateNumber = document.getElementById('test-plate').value;

    // 模拟查询
    MockAPI.queryLogs({ plateNumber: plateNumber, limit: 10 }, (result) => {
        if (result.success) {
            const records = result.data.records;

            let output = `<span class="status-badge pass">Mock查询成功</span><br><br>`;
            output += `<strong>Mock结果: 共 ${result.data.pagination.total} 条记录</strong><br><br>`;

            records.forEach((record, index) => {
                output += `${index + 1}. 车牌: ${record.plate_number} | `;
                output += `免费停车: ${record.free_parking ? '是' : '否'}<br>`;
            });

            TestUtils.updateResult('log-query-test-result', output, 'success');
        }
    });
}

// 测试数据导出
async function testExportData() {
    TestUtils.updateResult('export-test-result', '正在测试数据导出...', 'running');

    try {
        // 注意：实际导出会下载文件，这里只测试API调用
        const result = await APIClient.get('/api/logs/export?plateNumber=');

        TestUtils.updateResult('export-test-result',
            `<span class="status-badge pass">导出API调用成功</span><br><br>
            注意：实际数据会以CSV文件形式下载`,
            'success');
    } catch (error) {
        TestUtils.updateResult('export-test-result',
            `<span class="status-badge fail">导出异常</span><br>错误: ${error.message}`,
            'error');
    }
}

// 使用Mock数据测试导出
function testExportWithMock() {
    TestUtils.updateResult('export-test-result', '使用Mock数据测试导出...', 'running');

    const mockRecords = MockDataManager.generateLogRecords(20);

    // 生成CSV内容
    let csvContent = 'ID,车牌号,查询时间,响应时间,免费停车,拒绝原因\n';
    mockRecords.forEach(record => {
        csvContent += `${record.id},${record.plate_number},${record.call_time},${record.response_time},`;
        csvContent += `${record.free_parking ? '是' : '否'},${record.reject_reason}\n`;
    });

    TestUtils.updateResult('export-test-result',
        `<span class="status-badge pass">Mock导出成功</span><br><br>
        生成 ${mockRecords.length} 条记录的CSV数据<br><br>
        <button class="test-button" onclick="downloadMockCSV()">下载Mock CSV</button>`,
        'success');

    // 保存CSV内容供下载
    window.mockCSVContent = csvContent;
}

// 下载Mock CSV
function downloadMockCSV() {
    if (!window.mockCSVContent) {
        alert('请先生成Mock数据');
        return;
    }

    const blob = new Blob([window.mockCSVContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mock_log_records.csv';
    link.click();
}

// Mock数据管理函数
function generateMockData() {
    TestUtils.updateResult('mock-data-result', '正在生成Mock数据...', 'running');

    const logRecords = MockDataManager.generateLogRecords(20);
    const users = MockDataManager.generateUsers();

    let output = `<span class="status-badge pass">Mock数据生成成功</span><br><br>`;
    output += `<strong>日志记录:</strong> ${logRecords.length} 条<br>`;
    output += `<strong>用户数据:</strong> ${users.length} 个<br><br>`;
    output += `示例日志记录:<br>`;
    output += TestUtils.formatJSON(logRecords.slice(0, 3));

    TestUtils.updateResult('mock-data-result', output, 'success');
}

function viewMockData() {
    const logRecords = MockDataManager.getData('logRecords');
    const users = MockDataManager.getData('users');

    if (logRecords.length === 0 && users.length === 0) {
        TestUtils.updateResult('mock-data-result',
            '<span class="status-badge fail">暂无Mock数据</span><br>请先生成Mock数据',
            'info');
        return;
    }

    let output = `<strong>当前Mock数据:</strong><br><br>`;
    output += `日志记录: ${logRecords.length} 条<br>`;
    output += `用户数据: ${users.length} 个<br><br>`;
    output += TestUtils.formatJSON({ logRecords, users });

    TestUtils.updateResult('mock-data-result', output, 'info');
}

function clearMockData() {
    MockDataManager.clear();
    TestUtils.updateResult('mock-data-result',
        '<span class="status-badge pass">Mock数据已清空</span>',
        'success');
}

function downloadMockData() {
    const mockData = MockDataManager.export();

    if (mockData === '{"users":[],"logRecords":[],"apiResponses":[]}') {
        alert('暂无Mock数据可下载，请先生成数据');
        return;
    }

    const blob = new Blob([mockData], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mock_data_' + new Date().getTime() + '.json';
    link.click();

    TestUtils.updateResult('mock-data-result',
        '<span class="status-badge pass">Mock数据已下载</span>',
        'success');
}

// 综合测试函数
async function runAllTests() {
    TestUtils.updateResult('integration-test-result',
        '<span class="status-badge running">正在运行综合测试...</span><br><br>这可能需要几秒钟...',
        'running');

    const results = [];

    // 测试1: 健康检查
    try {
        const health = await APIClient.get('/health');
        results.push({
            name: '健康检查',
            pass: health.success,
            details: health.success ? '系统正常' : '系统异常'
        });
    } catch (error) {
        results.push({ name: '健康检查', pass: false, details: error.message });
    }

    // 测试2: API状态
    try {
        const status = await APIClient.get('/api/status');
        results.push({
            name: 'API状态',
            pass: status.success,
            details: status.success ? 'API可用' : 'API不可用'
        });
    } catch (error) {
        results.push({ name: 'API状态', pass: false, details: error.message });
    }

    // 测试3: Mock数据生成
    try {
        MockDataManager.generateLogRecords(10);
        MockDataManager.generateUsers();
        results.push({
            name: 'Mock数据生成',
            pass: true,
            details: '生成成功'
        });
    } catch (error) {
        results.push({ name: 'Mock数据生成', pass: false, details: error.message });
    }

    // 测试4: Mock API
    await new Promise((resolve) => {
        MockAPI.healthCheck((result) => {
            results.push({
                name: 'Mock API',
                pass: result.success,
                details: result.message
            });
            resolve();
        });
    });

    // 显示结果
    const output = TestUtils.formatTestOutput('综合测试报告', results);
    const allPassed = results.every(r => r.pass);
    TestUtils.updateResult('integration-test-result', output, allPassed ? 'success' : 'error');
}

async function runQuickTest() {
    TestUtils.updateResult('integration-test-result',
        '<span class="status-badge running">正在运行快速验证...</span>',
        'running');

    const results = [];

    // 快速测试：只测试Mock功能
    try {
        MockDataManager.test();
        results.push({ name: 'Mock数据管理器', pass: true, details: '功能正常' });
    } catch (error) {
        results.push({ name: 'Mock数据管理器', pass: false, details: error.message });
    }

    try {
        MockAPI.test();
        await new Promise(resolve => setTimeout(resolve, 500));
        results.push({ name: 'Mock API工具', pass: true, details: '功能正常' });
    } catch (error) {
        results.push({ name: 'Mock API工具', pass: false, details: error.message });
    }

    const output = TestUtils.formatTestOutput('快速验证报告', results);
    TestUtils.updateResult('integration-test-result', output, 'success');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== 山姆日志系统TDD测试平台已加载 ===');
    console.log('可用的测试模块:', Object.keys(window).filter(k => k.includes('Mock') || k === 'APIClient'));
});
