import cv2
import os

def extract_frames(video_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    print(f"Video: {video_path} | FPS: {fps} | Total Frames: {total_frames} | Duration: {duration:.2f}s")

    frame_count = 0
    saved_count = 0
    # Save a frame roughly every 0.5s
    interval = max(1, int(fps / 2))

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if frame_count % interval == 0:
            timestamp_sec = frame_count / fps
            out_file = os.path.join(output_dir, f"frame_{saved_count:03d}_{timestamp_sec:.2f}s.jpg")
            cv2.imwrite(out_file, frame)
            saved_count += 1
        frame_count += 1

    cap.release()
    print(f"Extracted {saved_count} frames to {output_dir}")

extract_frames(r"C:\Users\ELCOT\Downloads\Student portal.mp4", r"server\frames\student")
extract_frames(r"C:\Users\ELCOT\Downloads\HOD or Faculty.mp4", r"server\frames\faculty")
