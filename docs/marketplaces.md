# Sàn bán và người bán cá nhân ở Việt Nam

Quyết định 06/11/2026: dùng cả Gumroad và Lemon Squeezy, nhận tiền cá nhân, ở Việt Nam. Chưa có tài khoản hay khóa thật.

## Thiết kế
- `packages/engine/src/listing.ts`: giao diện `MarketplaceAdapter`. Hiện chỉ có adapter dry-run, không gọi mạng, chỉ dựng bản đăng để người duyệt xem.
- Adapter thật chỉ được viết sau khi KhoaTran đồng ý dùng khóa thật, và chỉ chạy khi có đề xuất đã được DUYỆT.

## Cần xác minh trước khi dùng tiền thật (chưa kiểm chứng)
- Mức phí: số trong `DEFAULT_FEES` chỉ là giá trị mặc định có thể sửa, phải đối chiếu trang giá hiện hành của từng sàn.
- Cách rút tiền về Việt Nam (PayPal, ngân hàng, Payoneer/Wise): kiểm tra từng sàn có hỗ trợ người bán ở Việt Nam không, phí chuyển đổi và phí rút.
- Thuế: thu nhập từ bán sản phẩm số cho khách nước ngoài vẫn có thể phải kê khai thuế thu nhập cá nhân ở Việt Nam; cần hỏi kế toán/cơ quan thuế về mức và cách kê khai. Nếu sàn là bên bán hộ (merchant of record), sàn lo thuế bán hàng/VAT ở nước người mua, nhưng thuế thu nhập của bạn thì không.
- Rủi ro: hoàn tiền và tranh chấp, tài khoản bị khóa khi thiếu xác minh danh tính, chính sách nội dung của sàn, bản quyền nội dung AI tạo ra.
- Hạn mức cho sổ cái: doanh thu ghi vào sổ phải là số ròng sau phí sàn và hoàn tiền, đối soát hằng ngày với báo cáo của sàn.
