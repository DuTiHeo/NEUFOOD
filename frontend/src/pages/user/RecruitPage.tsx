import { useState } from "react";
import styles from "./Recruit.module.css"
export default function Recruit() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault(); 
    setSubmitted(true);
  };

  return (
    
    <div className={styles.container}>
      <h3 className={styles.title}>
  ĐĂNG KÝ ỨNG TUYỂN NEUFOOD
</h3>

<p className={styles.subtitle}>
  <i>Điền thông tin vào biểu mẫu để ứng tuyển:</i>
</p>


      <form onSubmit={handleSubmit} className={styles.form}>
        <fieldset>
          <legend>Thông tin ứng viên</legend>

          <p>
            <b>1. Họ và tên:</b><br />
            <input
              type="text"
              placeholder="Nhập họ tên đầy đủ..."
              style={{ width: "60%" }}
              required
            />
          </p>

          <p>
            <b>2. Email:</b><br />
            <input
              type="email"
              style={{ width: "60%" }}
              required
            />
          </p>

          <p>
            <b>3. Số điện thoại:</b><br />
            <input
              type="text"
              style={{ width: "60%" }}
              required
            />
          </p>

          <p>
            <b>4. Vị trí ứng tuyển:</b><br />
            <select required>
              <option value="">-- Chọn vị trí --</option>
              <option>Frontend Developer</option>
              <option>Backend Developer</option>
              <option>Marketing</option>
              <option>Shipper</option>
            </select>
          </p>

          <p>
            <b>5. Bạn có thể làm việc:</b><br />
            <input type="radio" name="time" defaultChecked /> Part-time
            <br />
            <input type="radio" name="time" /> Full-time
          </p>

          <p>
            <b>6. Giới thiệu bản thân:</b><br />
            <textarea
              rows="4"
              cols="60"
              placeholder="Nhập nội dung..."
            ></textarea>
          </p>

          <p>
            <button type="submit">Gửi đăng ký</button>
            <button type="reset">Nhập lại</button>
          </p>
        </fieldset>
      </form>
           {submitted && (
        <p className={styles.success}>
          🎉 Đăng ký thành công!
        </p>
      )}
    </div>
  );
}