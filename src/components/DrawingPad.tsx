import { useEffect, useRef, useState } from "react";

interface DrawingPadProps {
  disabled?: boolean;
  onSubmit: (imageDataUrl: string) => void;
}

export function DrawingPad({ disabled = false, onSubmit }: DrawingPadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.fillStyle = "#fffdf5";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 5;
    context.strokeStyle = "#111827";
  }, []);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = event.currentTarget.width / rect.width;
    const scaleY = event.currentTarget.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) {
      return;
    }

    const context = canvasRef.current?.getContext("2d");
    if (!context) {
      return;
    }

    const point = pointFromEvent(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    setDrawing(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing || disabled) {
      return;
    }

    const context = canvasRef.current?.getContext("2d");
    if (!context) {
      return;
    }

    const point = pointFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function handlePointerUp() {
    setDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#fffdf5";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  function submitCanvas() {
    const imageData = canvasRef.current?.toDataURL("image/png");
    if (imageData) {
      onSubmit(imageData);
    }
  }

  return (
    <div className="drawing-pad">
      <canvas
        ref={canvasRef}
        width={640}
        height={420}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="drawing-actions">
        <button className="secondary-button" onClick={clearCanvas} disabled={disabled}>
          전체 지우기
        </button>
        <button className="primary-button" onClick={submitCanvas} disabled={disabled}>
          그림 제출
        </button>
      </div>
    </div>
  );
}
