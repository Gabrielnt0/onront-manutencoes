(() => {
  const TAU = Math.PI * 2;
  const faces = [], lines = [];
  const markers = [
    ['Motor', [-0.05, -0.05, 0.42]], ['Óleo do motor', [-0.1, -0.32, 0.42]],
    ['Corrente', [0.72, -0.55, 0.39]], ['Freio dianteiro', [-1.47, -0.58, 0.42]],
    ['Pneu dianteiro', [-1.47, -0.78, 0]], ['Pneu traseiro', [1.25, -0.78, 0]],
    ['Suspensão dianteira', [-1.28, -0.03, 0.3]], ['Suspensão traseira', [0.85, -0.18, 0.38]],
    ['Filtro de ar', [0.38, 0.17, 0.4]], ['Farol', [-1.38, 0.76, 0]],
    ['Escapamento', [0.72, -0.42, -0.48]], ['Lanterna e piscas', [1.45, 0.48, 0]]
  ];

  const shade = (value, amount) => {
    const n = parseInt(value.slice(1), 16);
    return `#${[16, 8, 0].map(s => Math.max(0, Math.min(255, (n >> s & 255) + amount)).toString(16).padStart(2, '0')).join('')}`;
  };
  const addFace = (points, color) => faces.push({ points, color });
  const addLine = (a, b, color, width = 5) => lines.push({ a, b, color, width });

  function box(cx, cy, cz, sx, sy, sz, color) {
    const v = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]
      .map(([x,y,z]) => [cx+x*sx/2, cy+y*sy/2, cz+z*sz/2]);
    [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[0,3,7,4]].forEach(ids => addFace(ids.map(i => v[i]), color));
  }

  function ellipsoid(cx, cy, cz, rx, ry, rz, color, lat = 6, lon = 14) {
    const grid = [];
    for (let j = 0; j <= lat; j++) {
      const p = -Math.PI / 2 + Math.PI * j / lat;
      grid[j] = [];
      for (let i = 0; i < lon; i++) {
        const a = TAU * i / lon;
        grid[j][i] = [cx + rx*Math.cos(p)*Math.cos(a), cy + ry*Math.sin(p), cz + rz*Math.cos(p)*Math.sin(a)];
      }
    }
    for (let j = 0; j < lat; j++) for (let i = 0; i < lon; i++) {
      const k = (i + 1) % lon;
      addFace([grid[j][i], grid[j][k], grid[j+1][k], grid[j+1][i]], color);
    }
  }

  function wheel(cx) {
    const cy = -0.62, radius = 0.58, tube = 0.10, width = 0.19, n = 22;
    const ring = (angle, z, r) => [cx+r*Math.cos(angle), cy+r*Math.sin(angle), z];
    for (let i = 0; i < n; i++) {
      const a = TAU*i/n, b = TAU*(i+1)/n;
      addFace([ring(a,-width,radius+tube),ring(b,-width,radius+tube),ring(b,width,radius+tube),ring(a,width,radius+tube)], '#13191c');
      addFace([ring(a,width,radius-tube),ring(b,width,radius-tube),ring(b,-width,radius-tube),ring(a,-width,radius-tube)], '#252d31');
      addFace([ring(a,width,radius+tube),ring(b,width,radius+tube),ring(b,width,radius-tube),ring(a,width,radius-tube)], '#080c0e');
    }
    for (let i = 0; i < 6; i++) {
      const a = TAU*i/6;
      addLine([cx,cy,0.205],[cx+radius*.78*Math.cos(a),cy+radius*.78*Math.sin(a),0.205],'#596267',3);
    }
  }

  function buildModel() {
    wheel(-1.47); wheel(1.25);
    addLine([-0.95,0.42,0],[0.72,0.34,0],'#242c30',13);
    addLine([-0.75,0.35,0],[0.0,-0.32,0],'#30393e',12);
    addLine([0.0,-0.32,0],[1.25,-0.62,0],'#30393e',11);
    addLine([0.08,-0.27,0.28],[1.25,-0.62,0.28],'#3d464a',9);
    addLine([-1.1,0.55,0],[-1.47,-0.62,0],'#c3c9cc',9);
    addLine([-1.1,0.55,0.34],[-1.47,-0.62,0.34],'#9ca7ac',8);
    addLine([-1.12,0.67,0],[-1.15,0.98,0],'#222a2e',10);
    addLine([-1.15,0.94,-0.48],[-1.15,0.94,0.48],'#242c30',9);
    ellipsoid(-0.45,0.55,0,0.73,0.43,0.43,'#161e22');
    ellipsoid(-0.63,0.58,0,0.58,0.34,0.44,'#0d1418');
    box(0.63,0.58,0,1.55,0.25,0.72,'#1f292e');
    box(1.22,0.40,0,0.72,0.27,0.58,'#10181c');
    ellipsoid(1.50,0.43,0,0.22,0.15,0.35,'#b92d36',4,10);
    box(-0.06,-0.04,0,0.66,0.62,0.64,'#3b454a');
    ellipsoid(-0.12,-0.13,0.34,0.35,0.32,0.09,'#697277',5,12);
    for (let i=0;i<5;i++) addLine([-0.35,0.18+i*.055,-0.34],[0.2,0.18+i*.055,-0.34],'#737d82',3);
    box(0.39,0.15,0,0.48,0.43,0.66,'#222b30');
    addLine([-0.15,-0.24,-0.43],[0.38,-0.48,-0.48],'#515b60',10);
    addLine([0.35,-0.48,-0.48],[1.43,-0.38,-0.48],'#20282c',24);
    addLine([1.10,-0.36,-0.49],[1.53,-0.31,-0.49],'#11171a',30);
    addLine([0.68,0.30,0.34],[1.02,-0.50,0.34],'#aab2b5',10);
    addLine([0.68,0.30,-0.34],[1.02,-0.50,-0.34],'#aab2b5',10);
    addLine([0.08,-0.38,0.30],[1.25,-0.55,0.30],'#b69b45',5);
    box(-1.36,0.72,0,0.34,0.33,0.38,'#dce5e8');
    box(-1.40,0.78,0,0.38,0.24,0.42,'#11191d');
    ellipsoid(-1.18,1.02,-0.52,0.16,0.11,0.05,'#879398',4,10);
    ellipsoid(-1.18,1.02,0.52,0.16,0.11,0.05,'#879398',4,10);
  }
  buildModel();

  function init(canvas, onSelect) {
    const ctx = canvas.getContext('2d');
    const camera = { yaw: 0, pitch: -0.10, zoom: 1, targetYaw: 0 };
    const markerColors = {};
    let width = 1, height = 1, dragging = false, moved = false, lastX = 0, lastY = 0, pinch = 0, projectedMarkers = [], animationFrame = 0;

    const transform = ([x,y,z]) => {
      const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
      const rx = x*cy + z*sy, rz = -x*sy + z*cy;
      const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
      return [rx, y*cp-rz*sp, y*sp+rz*cp];
    };
    const project = point => {
      const [x,y,z] = transform(point), focal = Math.min(width,height)*1.55*camera.zoom, depth = 5.2-z;
      return { x:width/2+x*focal/depth, y:height*.54-y*focal/depth, z, scale:focal/depth };
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      width = rect.width; height = rect.height;
      if (canvas.width !== Math.round(width*dpr) || canvas.height !== Math.round(height*dpr)) {
        canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
        ctx.setTransform(dpr,0,0,dpr,0,0);
      }
    };
    const draw = () => {
      resize(); ctx.clearRect(0,0,width,height);
      const ground = project([0,-1.23,0]);
      const gradient = ctx.createRadialGradient(ground.x,ground.y,4,ground.x,ground.y,width*.34);
      gradient.addColorStop(0,'rgba(0,0,0,.55)'); gradient.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gradient; ctx.beginPath(); ctx.ellipse(ground.x,ground.y,width*.34,height*.075,0,0,TAU); ctx.fill();
      faces.map(face => {
        const p = face.points.map(project);
        return { ...face, p, depth:p.reduce((s,v)=>s+v.z,0)/p.length };
      }).sort((a,b)=>a.depth-b.depth).forEach(face => {
        const a=transform(face.points[0]), b=transform(face.points[1]), c=transform(face.points[2]);
        const ux=b[0]-a[0], uy=b[1]-a[1], vx=c[0]-a[0], vy=c[1]-a[1];
        ctx.fillStyle=shade(face.color,Math.round(Math.max(-24,Math.min(28,(ux*vy-uy*vx)*18))));
        ctx.beginPath(); ctx.moveTo(face.p[0].x,face.p[0].y); face.p.slice(1).forEach(p=>ctx.lineTo(p.x,p.y)); ctx.closePath(); ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,.035)'; ctx.lineWidth=.7; ctx.stroke();
      });
      lines.map(line => ({...line,a:project(line.a),b:project(line.b)})).sort((a,b)=>(a.a.z+a.b.z)-(b.a.z+b.b.z)).forEach(line => {
        ctx.strokeStyle=line.color; ctx.lineWidth=Math.max(1,line.width*(line.a.scale+line.b.scale)/260); ctx.lineCap='round';
        ctx.beginPath(); ctx.moveTo(line.a.x,line.a.y); ctx.lineTo(line.b.x,line.b.y); ctx.stroke();
      });
      projectedMarkers = markers.map(([name,point]) => ({name,...project(point)}));
      projectedMarkers.forEach((mark,index) => {
        ctx.fillStyle=markerColors[mark.name]||'#54d691'; ctx.strokeStyle='#f5fff9'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(mark.x,mark.y,10,0,TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#07120c'; ctx.font='700 10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(index+1),mark.x,mark.y+.5);
      });
    };
    const animate = () => {
      const delta = Math.atan2(Math.sin(camera.targetYaw-camera.yaw),Math.cos(camera.targetYaw-camera.yaw));
      if (Math.abs(delta)>.002) {
        camera.yaw += delta*.14; draw(); animationFrame=requestAnimationFrame(animate);
      } else {
        camera.yaw=camera.targetYaw; draw(); animationFrame=0;
      }
    };
    const startAnimation = () => { if(!animationFrame) animationFrame=requestAnimationFrame(animate); };
    const localPoint = event => ({x:event.clientX-canvas.getBoundingClientRect().left,y:event.clientY-canvas.getBoundingClientRect().top});
    canvas.addEventListener('pointerdown', event => { dragging=true; moved=false; lastX=event.clientX; lastY=event.clientY; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', event => {
      if(!dragging) return;
      const dx=event.clientX-lastX, dy=event.clientY-lastY; moved ||= Math.abs(dx)+Math.abs(dy)>3;
      camera.yaw += dx*.009; camera.pitch=Math.max(-.42,Math.min(.32,camera.pitch+dy*.006)); camera.targetYaw=camera.yaw; lastX=event.clientX; lastY=event.clientY; draw();
    });
    canvas.addEventListener('pointerup', event => {
      dragging=false;
      if(!moved) {
        const p=localPoint(event), hit=projectedMarkers.map(m=>({...m,d:Math.hypot(m.x-p.x,m.y-p.y)})).sort((a,b)=>a.d-b.d)[0];
        if(hit?.d<28) onSelect(hit.name);
      }
    });
    canvas.addEventListener('wheel', event => { event.preventDefault(); camera.zoom=Math.max(.72,Math.min(1.55,camera.zoom-event.deltaY*.001)); draw(); },{passive:false});
    canvas.addEventListener('touchmove', event => {
      if(event.touches.length===2) {
        const d=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);
        if(pinch) camera.zoom=Math.max(.72,Math.min(1.55,camera.zoom*d/pinch)); pinch=d; draw();
      }
    },{passive:true});
    canvas.addEventListener('touchend',()=>{pinch=0;});
    new ResizeObserver(draw).observe(canvas);
    draw();
    return {
      setView(yaw) { camera.targetYaw=yaw; startAnimation(); },
      setStatus(name, color) { if (markerColors[name] !== color) { markerColors[name] = color; draw(); } }
    };
  }
  window.Moto3D = { init };
})();
