(function createI18n() {
  const english = {
    'Dashboard': 'Dashboard',
    'Motors': 'Motors',
    'Calibration': 'Calibration',
    'Alerts': 'Alerts',
    'Dataset': 'Dataset',
    'Settings': 'Settings',
    'Motor condition monitoring': 'Motor condition monitoring',
    'Edge AI đang phân tích trực tiếp trên ESP32 và gửi cảnh báo lên Dashboard.': 'Edge AI analyzes the motor directly on the ESP32 and sends alerts to the Dashboard.',
    'Đăng xuất': 'Sign out',
    'Tổng quan vận hành': 'Operations overview',
    'Dữ liệu cảm biến và cảnh báo theo ngưỡng thời gian thực': 'Real-time sensor data and threshold alerts',
    'Chọn motor': 'Select motor',
    'Chưa kết nối': 'Not connected',
    'Đã kết nối': 'Connected',
    'Mất kết nối': 'Disconnected',
    'Kết nối': 'Connect',
    'Ngắt kết nối': 'Disconnect',
    'Chưa có dữ liệu': 'No data',
    'Cập nhật:': 'Updated:',
    'Chưa có': 'Not available',
    'Chỉ số cảm biến': 'Sensor metrics',
    'Cảnh báo gần đây': 'Recent alerts',
    'Xem tất cả': 'View all',
    'Thời gian': 'Time',
    'Motor': 'Motor',
    'Nội dung': 'Description',
    'Mức độ': 'Severity',
    'Trạng thái': 'Status',
    'Chờ tích hợp': 'Pending integration',
    'Mô-đun AI chưa được tích hợp': 'AI module is not integrated',
    'Backend, database và giao diện đã chừa sẵn điểm nhận kết quả suy luận từ nhóm AI.': 'The backend, database, and interface are ready to receive inference results from the AI team.',
    'Mô-đun AI đang chờ nhóm phụ trách tích hợp': 'The AI module is awaiting integration by the responsible team',
    'Không có cảnh báo cho motor này.': 'There are no alerts for this motor.',
    'Chưa có motor để theo dõi': 'No motors to monitor',
    'Thêm motor đầu tiên, sau đó ghi dữ liệu cảm biến để dashboard hiển thị biểu đồ.': 'Add your first motor, then record sensor data to populate the dashboard charts.',
    'Dashboard đã được đặt lại': 'Dashboard has been reset',
    'Motor vừa chọn đã được xóa. Chọn một motor khác để xem dữ liệu mới.': 'The selected motor was deleted. Choose another motor to view fresh data.',
    'Chọn motor để xem dữ liệu': 'Select a motor to view data',
    'Thêm motor': 'Add motor',
    'Đã kết nối thiết bị': 'Device connected',
    'Đã ngắt kết nối': 'Device disconnected',
    'Quản lý motor': 'Motor management',
    'Thiết bị, thông số định mức và trạng thái kết nối': 'Devices, rated specifications, and connection status',
    'Tổng motor': 'Total motors',
    'Đang kết nối': 'Connected',
    'Đang bảo trì': 'Under maintenance',
    'Không tìm thấy motor': 'No motors found',
    'Thêm thiết bị mới hoặc thay đổi bộ lọc hiện tại.': 'Add a new device or change the current filters.',
    'Tìm theo tên, mã thiết bị hoặc vị trí': 'Search by name, device code, or location',
    'Tất cả trạng thái': 'All statuses',
    'Đang hoạt động': 'Active',
    'Bảo trì': 'Maintenance',
    'Ngừng hoạt động': 'Inactive',
    'Vị trí': 'Location',
    'Thông số': 'Specifications',
    'Hoạt động': 'Operation',
    'Chi tiết': 'Details',
    'Chỉnh sửa': 'Edit',
    'Xóa': 'Delete',
    'Cập nhật motor': 'Update motor',
    'Tên motor *': 'Motor name *',
    'Mã thiết bị': 'Device code',
    'Tự sinh nếu để trống': 'Generated automatically when empty',
    'Model': 'Model',
    'Số serial': 'Serial number',
    'Công suất (kW)': 'Rated power (kW)',
    'Điện áp (V)': 'Rated voltage (V)',
    'Dòng điện (A)': 'Rated current (A)',
    'Ghi chú': 'Notes',
    'Hủy': 'Cancel',
    'Lưu motor': 'Save motor',
    'Quay lại': 'Back',
    'Dữ liệu gần đây': 'Recent readings',
    'Xuất CSV': 'Export CSV',
    'Xu hướng cảm biến': 'Sensor trends',
    'Thông tin thiết bị': 'Device information',
    'Serial': 'Serial number',
    'Công suất': 'Rated power',
    'Điện áp': 'Rated voltage',
    'Dòng định mức': 'Rated current',
    'Lần cuối nhận dữ liệu': 'Last data received',
    'Không có': 'None',
    'Chưa cập nhật': 'Not updated',
    'Chưa cập nhật vị trí': 'Location not updated',
    'Chưa có dữ liệu cảm biến': 'No sensor data',
    'Chưa có dữ liệu cảm biến.': 'No sensor data.',
    'Đã cập nhật motor': 'Motor updated',
    'Đã thêm motor': 'Motor added',
    'Đã xóa motor': 'Motor deleted',
    'Cảnh báo vận hành': 'Operational alerts',
    'Cảnh báo theo ngưỡng hệ thống, xác nhận và xử lý có lưu lịch sử': 'System threshold alerts with acknowledgement and resolution history',
    'Chưa xử lý': 'Open',
    'Đã xác nhận': 'Acknowledged',
    'Đã xử lý': 'Resolved',
    'Tất cả motor': 'All motors',
    'Tất cả mức độ': 'All severities',
    'Tất cả trạng thái': 'All statuses',
    'Cảnh báo': 'Alert',
    'Xác nhận': 'Acknowledge',
    'Không có cảnh báo': 'No alerts',
    'Không có dữ liệu phù hợp với bộ lọc hiện tại.': 'No data matches the current filters.',
    'Đã cập nhật cảnh báo': 'Alert updated',
    'Dataset cảm biến': 'Sensor dataset',
    'Duyệt, bổ sung dữ liệu thử nghiệm và xuất CSV': 'Browse, add test readings, and export CSV',
    'Thêm mẫu đo': 'Add reading',
    'Từ ngày': 'From',
    'Đến ngày': 'To',
    'Áp dụng': 'Apply',
    'Nhiệt độ': 'Temperature',
    'Âm thanh': 'Sound level',
    'Nguồn': 'Source',
    'Tối đa 1.000 dòng mỗi lần tải': 'Up to 1,000 rows per request',
    'Thêm mẫu đo thủ công': 'Add manual reading',
    'Thời gian đo': 'Recorded time',
    'Nếu giá trị vượt ngưỡng hiệu chuẩn, backend sẽ tự tạo cảnh báo hệ thống.': 'The backend automatically creates a system alert when a reading exceeds its calibrated threshold.',
    'Lưu mẫu đo': 'Save reading',
    'Chưa có mẫu đo.': 'No readings available.',
    'Đã lưu mẫu đo': 'Reading saved',
    'Hãy thêm motor trước': 'Add a motor first',
    'Hiệu chuẩn ngưỡng': 'Threshold calibration',
    'Tạo baseline từ dữ liệu đo gần nhất, không bao gồm suy luận AI': 'Create a baseline from recent readings without AI inference',
    'Tạo lần hiệu chuẩn mới': 'Create a new calibration',
    'Số mẫu gần nhất': 'Recent sample count',
    'Baseline được tính trung bình từ 5 đến 500 mẫu đo gần nhất.': 'The baseline is averaged from the 5 to 500 most recent readings.',
    'Ngưỡng rung (mm/s)': 'Vibration threshold (mm/s)',
    'Ngưỡng dòng (A)': 'Current threshold (A)',
    'Ngưỡng nhiệt (°C)': 'Temperature threshold (°C)',
    'Ngưỡng ồn (dB)': 'Sound threshold (dB)',
    'Tự tính': 'Calculated automatically',
    'Bắt đầu hiệu chuẩn': 'Start calibration',
    'Lịch sử hiệu chuẩn': 'Calibration history',
    'Mới nhất trước': 'Newest first',
    'Số mẫu': 'Samples',
    'Ngưỡng cảnh báo': 'Alert thresholds',
    'Chưa có lần hiệu chuẩn.': 'No calibration history.',
    'Hiệu chuẩn thành công': 'Calibration completed',
    'Cài đặt tài khoản': 'Account settings',
    'Hồ sơ, thông báo và bảo mật phiên đăng nhập': 'Profile, notifications, and session security',
    'Hồ sơ': 'Profile',
    'Họ và tên': 'Full name',
    'Lưu hồ sơ': 'Save profile',
    'Đổi mật khẩu': 'Change password',
    'Mật khẩu hiện tại': 'Current password',
    'Mật khẩu mới': 'New password',
    'Ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số.': 'At least 8 characters with uppercase, lowercase, and a number.',
    'Tùy chọn': 'Preferences',
    'Ngôn ngữ': 'Language',
    'Tiếng Việt': 'Vietnamese',
    'Thông báo qua email': 'Email notifications',
    'Thông báo trình duyệt': 'Browser notifications',
    'Lưu tùy chọn': 'Save preferences',
    'Phiên đăng nhập': 'Login sessions',
    'Đăng xuất tất cả sẽ vô hiệu hóa mọi phiên đang mở, kể cả trình duyệt hiện tại.': 'Signing out everywhere invalidates every active session, including this browser.',
    'Đăng xuất tất cả thiết bị': 'Sign out of all devices',
    'Đã lưu hồ sơ': 'Profile saved',
    'Đã lưu tùy chọn': 'Preferences saved',
    'Đăng xuất khỏi tất cả thiết bị?': 'Sign out of all devices?',
    'Trợ năng nhanh': 'Quick accessibility',
    'Đổi cỡ chữ': 'Change text size',
    'Tương phản cao': 'High contrast',
    'Giảm chuyển động': 'Reduce motion',
    'Bỏ qua điều hướng': 'Skip navigation',
    'Trạng thái truyền động trực tiếp': 'Live drive status',
    'Mô hình phản hồi theo trạng thái hiển thị và giúp nhận diện nhanh khu vực motor đang được theo dõi.': 'The model reflects the displayed status and helps identify the monitored motor area.',
    'kênh cảm biến': 'sensor channels',
    'làm mới': 'refresh',
    'giám sát': 'monitoring',
    'Thông tin luồng dữ liệu': 'Data stream information',
    'Mô hình động cơ ba chiều đang quay': 'Rotating three-dimensional motor model',
    'Nhóm cài đặt': 'Settings groups',
    'Tài khoản': 'Account',
    'Giao diện': 'Appearance',
    'Trợ năng': 'Accessibility',
    'Thông báo & dữ liệu': 'Notifications & data',
    'Bảo mật': 'Security',
    'Thông tin cá nhân': 'Personal information',
    'Tài khoản của bạn': 'Your account',
    'Cập nhật tên hiển thị, email đăng nhập và mật khẩu.': 'Update your display name, login email, and password.',
    'Không gian làm việc': 'Workspace',
    'Chọn cách hiển thị phù hợp với ánh sáng và lượng thông tin cần theo dõi.': 'Choose a display mode that suits the lighting and amount of information you monitor.',
    'Chủ đề màu': 'Color theme',
    'Tự động theo thiết bị hoặc chọn sáng, tối.': 'Follow your device automatically or choose light or dark.',
    'Theo hệ thống': 'System',
    'Sáng dịu': 'Soft light',
    'Tối': 'Dark',
    'Cỡ chữ': 'Text size',
    'Áp dụng cho toàn bộ dashboard và bảng dữ liệu.': 'Applied across the dashboard and data tables.',
    'Nhỏ': 'Small',
    'Tiêu chuẩn': 'Standard',
    'Lớn': 'Large',
    'Mật độ hiển thị': 'Display density',
    'Chế độ gọn hiển thị nhiều dòng dữ liệu hơn.': 'Compact mode shows more data rows.',
    'Thoải mái': 'Comfortable',
    'Gọn': 'Compact',
    'Dễ đọc và dễ thao tác': 'Readable and operable',
    'Các tùy chọn này áp dụng ngay, bao gồm cả dashboard thời gian thực.': 'These preferences apply immediately, including to the real-time dashboard.',
    'Làm rõ đường viền, chữ và trạng thái cảnh báo.': 'Strengthens borders, text, and alert states.',
    'Dừng hiệu ứng 3D và các chuyển động không thiết yếu.': 'Stops 3D effects and non-essential motion.',
    'Mô hình motor 3D': '3D motor model',
    'Hiển thị mô hình quay trực tiếp trên dashboard.': 'Shows a live rotating model on the dashboard.',
    'Luồng cập nhật': 'Update stream',
    'Thông báo và dữ liệu': 'Notifications and data',
    'Điều chỉnh kênh nhận thông báo và tần suất đồng bộ dashboard.': 'Control notification channels and dashboard refresh frequency.',
    'Nhận cảnh báo vận hành ở địa chỉ email tài khoản.': 'Receive operational alerts at your account email.',
    'Cho phép cảnh báo hiển thị khi dashboard đang mở.': 'Allow alerts while the dashboard is open.',
    'Chu kỳ làm mới': 'Refresh interval',
    'Tần suất dashboard tự lấy dữ liệu mới.': 'How often the dashboard fetches new data.',
    '3 giây': '3 seconds',
    '5 giây': '5 seconds',
    '10 giây': '10 seconds',
    '30 giây': '30 seconds',
    '1 phút': '1 minute',
    'Chuyển toàn bộ nội dung sang tiếng Việt hoặc tiếng Anh.': 'Switch all content between Vietnamese and English.',
    'Kiểm soát truy cập': 'Access control',
    'Bảo mật phiên đăng nhập': 'Session security',
    'Thu hồi toàn bộ phiên khi nghi ngờ tài khoản đang được sử dụng ở nơi khác.': 'Revoke all sessions when you suspect the account is being used elsewhere.',
    'Thao tác này vô hiệu hóa mọi phiên đang mở, kể cả trình duyệt hiện tại.': 'This invalidates every active session, including the current browser.',
    'Đăng xuất tất cả': 'Sign out everywhere',
    'Mọi thay đổi tùy chọn cần được lưu.': 'Preference changes must be saved.',
    'Bạn có thay đổi chưa lưu.': 'You have unsaved changes.',
    'Đang lưu tùy chọn...': 'Saving preferences...',
    'Đã đồng bộ tùy chọn với tài khoản.': 'Preferences synced with your account.',
    'Chưa thể lưu. Vui lòng thử lại.': 'Could not save. Please try again.',
    'active': 'Active',
    'inactive': 'Inactive',
    'maintenance': 'Maintenance',
    'connected': 'Connected',
    'disconnected': 'Disconnected',
    'open': 'Open',
    'acknowledged': 'Acknowledged',
    'resolved': 'Resolved',
    'critical': 'Critical',
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low',
    'engineer': 'Engineer',
    'admin': 'Administrator',
    'viewer': 'Viewer',
  };

  const vietnamese = {
    Dashboard: 'Tổng quan',
    Motors: 'Thiết bị',
    Calibration: 'Hiệu chuẩn',
    Alerts: 'Cảnh báo',
    Dataset: 'Dữ liệu',
    Settings: 'Cài đặt',
    'Motor condition monitoring': 'Giám sát sức khỏe motor',
    'Edge AI đang phân tích trực tiếp trên ESP32 và gửi cảnh báo lên Dashboard.': 'Edge AI đang phân tích trực tiếp trên ESP32 và gửi cảnh báo lên Dashboard.',
    'Vibration RMS': 'Độ rung RMS',
    'Current RMS': 'Dòng điện RMS',
    Temperature: 'Nhiệt độ',
    'Sound Level': 'Độ ồn',
    active: 'Đang hoạt động',
    inactive: 'Ngừng hoạt động',
    maintenance: 'Bảo trì',
    connected: 'Đã kết nối',
    disconnected: 'Mất kết nối',
    open: 'Chưa xử lý',
    acknowledged: 'Đã xác nhận',
    resolved: 'Đã xử lý',
    critical: 'Nghiêm trọng',
    high: 'Cao',
    medium: 'Trung bình',
    low: 'Thấp',
    engineer: 'Kỹ sư',
    admin: 'Quản trị viên',
    viewer: 'Người xem',
  };

  Object.entries(english).forEach(([vietnameseText, englishText]) => {
    if (englishText !== vietnameseText && !vietnamese[englishText]) {
      vietnamese[englishText] = vietnameseText;
    }
  });

  let currentLanguage = 'vi';
  let observer;

  function dictionary() {
    return currentLanguage === 'en' ? english : vietnamese;
  }

  function translate(value) {
    const source = String(value ?? '');
    const trimmed = source.trim();
    const translated = dictionary()[trimmed];
    if (!translated) return source;
    return source.replace(trimmed, translated);
  }

  function apply(root = document) {
    if (root.nodeType === Node.TEXT_NODE) {
      root.nodeValue = translate(root.nodeValue);
      return;
    }
    if (!(root instanceof Element || root instanceof Document)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      if (!node.parentElement?.closest('script, style, [data-no-i18n]')) {
        node.nodeValue = translate(node.nodeValue);
      }
    });

    const elements = root instanceof Element
      ? [root, ...root.querySelectorAll('[placeholder], [title], [aria-label]')]
      : [...document.querySelectorAll('[placeholder], [title], [aria-label]')];
    elements.forEach((element) => {
      ['placeholder', 'title', 'aria-label'].forEach((attribute) => {
        if (element.hasAttribute(attribute)) {
          element.setAttribute(attribute, translate(element.getAttribute(attribute)));
        }
      });
    });
    document.title = translate(document.title);
  }

  function setLanguage(language) {
    currentLanguage = language === 'en' ? 'en' : 'vi';
    document.documentElement.lang = currentLanguage;
    apply(document);

    if (!observer) {
      observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => apply(node));
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  window.MotorCareI18n = {
    apply,
    setLanguage,
    t: translate,
    get language() {
      return currentLanguage;
    },
  };
}());
