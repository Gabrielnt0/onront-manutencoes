(() => {
  const TAU = Math.PI * 2;
  const faces = [], lines = [], decals = [];
  const GREEN = '#0b8f4a', GREEN_DARK = '#075c34', BLACK = '#12191c';
  const METAL = '#69757a', SILVER = '#c8d1d4', RED = '#c2303a', AMBER = '#e8a12b';

  const markers = [
    { name: 'Motor', point: [-0.05, -0.05, 0.42], part: 'Motor' },
    { name: 'Óleo do motor', point: [-0.30, -0.20, 0.40], part: 'Óleo do motor' },
    { name: 'Corrente', point: [0.72, -0.55, 0.32], part: 'Corrente' },
    { name: 'Freio dianteiro', point: [-1.30, -0.42, 0.30], part: 'Freio dianteiro' },
    { name: 'Pneu dianteiro', point: [-1.47, -0.78, 0], part: 'Pneu dianteiro' },
    { name: 'Pneu traseiro', point: [1.25, -0.78, 0], part: 'Pneu traseiro' },
    { name: 'Suspensão dianteira', point: [-1.28, -0.03, 0.22], part: 'Suspensão dianteira' },
    { name: 'Suspensão traseira', point: [0.88, -0.16, 0.32], part: 'Suspensão traseira' },
    { name: 'Filtro de ar', point: [0.38, 0.22, 0.34], part: 'Filtro de ar' },
    { name: 'Farol', point: [-1.46, 0.76, 0], part: 'Farol' },
    { name: 'Escapamento', point: [1.05, -0.40, 0.52], part: 'Escapamento' },
    { name: 'Lanterna e piscas', point: [1.48, 0.52, 0], part: 'Lanterna e piscas' }
  ];
  const sideParts = new Set(['Tanque', 'Carenagem lateral', 'Selim', 'Guidão', 'Painel', 'Quadro', 'Para-lama dianteiro']);

  const shade = (value, amount) => {
    const n = parseInt(value.slice(1), 16);
    return `#${[16, 8, 0].map(s => Math.max(0, Math.min(255, (n >> s & 255) + amount)).toString(16).padStart(2, '0')).join('')}`;
  };
  const addFace = (points, color, part) => faces.push({ points, color, part });
  const addLine = (a, b, color, width, part) => lines.push({ a, b, color, width, part });
  const addDecal = (point, text, color, size, part) => decals.push({ point, text, color, size, part });

  function box(cx, cy, cz, sx, sy, sz, color, part) {
    const v = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]
      .map(([x,y,z]) => [cx+x*sx/2, cy+y*sy/2, cz+z*sz/2]);
    [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[0,3,7,4]].forEach(ids => addFace(ids.map(i => v[i]), color, part));
  }

  function ellipsoid(cx, cy, cz, rx, ry, rz, color, part, lat = 6, lon = 14) {
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
      addFace([grid[j][i], grid[j][k], grid[j+1][k], grid[j+1][i]], color, part);
    }
  }

  function disc(cx, cy, cz, radius, color, part, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = TAU*i/n, b = TAU*(i+1)/n;
      addFace([[cx,cy,cz],[cx+radius*Math.cos(a),cy+radius*Math.sin(a),cz],[cx+radius*Math.cos(b),cy+radius*Math.sin(b),cz]], color, part);
    }
  }

  function coil(a, b, turns, color, part) {
    for (let i = 0; i < turns; i++) {
      const t0 = i / turns, t1 = (i + .55) / turns;
      const lerp = t => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
      const p = lerp(t0), q = lerp(t1);
      addLine([p[0],p[1],p[2]+.055],[q[0],q[1],q[2]-.055], color, 3, part);
    }
  }

  function wheel(cx, part) {
    const cy = -0.62, radius = 0.56, tube = 0.10, width = 0.18, n = 24;
    const ring = (angle, z, r) => [cx+r*Math.cos(angle), cy+r*Math.sin(angle), z];
    for (let i = 0; i < n; i++) {
      const a = TAU*i/n, b = TAU*(i+1)/n;
      addFace([ring(a,-width,radius+tube),ring(b,-width,radius+tube),ring(b,width,radius+tube),ring(a,width,radius+tube)], '#0e1417', part);
      addFace([ring(a,width,radius-tube),ring(b,width,radius-tube),ring(b,-width,radius-tube),ring(a,-width,radius-tube)], '#252d31', part);
      addFace([ring(a,width,radius+tube),ring(b,width,radius+tube),ring(b,width,radius-tube),ring(a,width,radius-tube)], '#4a5459', part);
      addFace([ring(a,-width,radius+tube),ring(b,-width,radius+tube),ring(b,-width,radius-tube),ring(a,-width,radius-tube)], '#4a5459', part);
      if (i % 2 === 0) {
        const mid = (a+b)/2;
        addLine([cx+(radius+tube)*Math.cos(mid),cy+(radius+tube)*Math.sin(mid),-width*.8],
                [cx+(radius+tube)*Math.cos(mid),cy+(radius+tube)*Math.sin(mid),width*.8], '#05090a', 2, part);
      }
    }
    disc(cx, cy, width+.005, radius-tube, SILVER, part, 20);
    disc(cx, cy, -width-.005, radius-tube, SILVER, part, 20);
    ellipsoid(cx, cy, 0, .11, .11, .22, METAL, part, 5, 12);
    for (let i = 0; i < 6; i++) {
      const a = TAU*i/6;
      addLine([cx,cy,width+.03],[cx+(radius-tube)*.85*Math.cos(a),cy+(radius-tube)*.85*Math.sin(a),width+.03],'#8b969b',3,part);
      addLine([cx,cy,-width-.03],[cx+(radius-tube)*.85*Math.cos(a),cy+(radius-tube)*.85*Math.sin(a),-width-.03],'#8b969b',3,part);
    }
  }

  function buildModel() {
    // Quadro e braço oscilante
    addLine([-1.12,0.92,0],[0.72,0.52,0],'#2b3337',12,'Quadro');
    addLine([-1.12,0.92,0],[-0.45,0.62,0],'#2b3337',11,'Quadro');
    addLine([-0.45,0.62,0],[0.72,0.52,0],'#2b3337',11,'Quadro');
    addLine([-1.05,0.72,0],[-0.18,-0.32,0],'#343d42',13,'Quadro');
    addLine([-0.18,-0.32,0],[0.92,-0.30,0],'#343d42',12,'Quadro');
    addLine([0.72,0.52,0],[1.22,-0.62,0],'#343d42',12,'Quadro');
    addLine([0.72,0.52,0],[1.45,0.42,0],'#2b3337',9,'Quadro');
    addLine([-0.05,-0.34,0.26],[1.25,-0.62,0.26],'#59636a',10,'Quadro');
    addLine([-0.05,-0.34,-0.26],[1.25,-0.62,-0.26],'#59636a',10,'Quadro');

    // Rodas, freio e transmissão
    wheel(-1.47, 'Pneu dianteiro');
    wheel(1.25, 'Pneu traseiro');
    disc(-1.47,-0.62,0.25,0.30,'#b8c1c5','Freio dianteiro',20);
    disc(-1.47,-0.62,-0.25,0.30,'#b8c1c5','Freio dianteiro',20);
    box(-1.30,-0.42,0.29,0.15,0.20,0.12,'#394348','Freio dianteiro');
    disc(1.25,-0.62,0.26,0.21,'#8d9498','Corrente',16);
    addLine([0.04,-0.20,0.30],[1.25,-0.62,0.30],'#b69b45',5,'Corrente');
    addLine([0.04,-0.28,0.30],[1.25,-0.70,0.30],'#b69b45',5,'Corrente');

    // Suspensões
    addLine([-1.12,0.92,-0.20],[-1.47,-0.62,-0.20],'#20282c',10,'Suspensão dianteira');
    addLine([-1.12,0.92,0.20],[-1.47,-0.62,0.20],'#20282c',10,'Suspensão dianteira');
    addLine([-1.32,0.10,-0.20],[-1.47,-0.62,-0.20],SILVER,8,'Suspensão dianteira');
    addLine([-1.32,0.10,0.20],[-1.47,-0.62,0.20],SILVER,8,'Suspensão dianteira');
    for (let i = 0; i < 7; i++) {
      const a = Math.PI*(0.18+i*0.11), b = Math.PI*(0.18+(i+1)*0.11);
      addLine([-1.47+0.70*Math.cos(a),-0.62+0.70*Math.sin(a),-0.14],
              [-1.47+0.70*Math.cos(b),-0.62+0.70*Math.sin(b),-0.14],BLACK,9,'Para-lama dianteiro');
      addLine([-1.47+0.70*Math.cos(a),-0.62+0.70*Math.sin(a),0.14],
              [-1.47+0.70*Math.cos(b),-0.62+0.70*Math.sin(b),0.14],BLACK,9,'Para-lama dianteiro');
    }
    addLine([0.72,0.18,0.30],[1.02,-0.52,0.30],'#20282c',9,'Suspensão traseira');
    coil([0.72,0.18,0.30],[1.02,-0.52,0.30],7,GREEN,'Suspensão traseira');
    addLine([0.72,0.18,-0.30],[1.02,-0.52,-0.30],'#20282c',9,'Suspensão traseira');
    coil([0.72,0.18,-0.30],[1.02,-0.52,-0.30],7,GREEN,'Suspensão traseira');

    // Motor, cárter, aletas e óleo
    box(-0.06,-0.04,0,0.72,0.66,0.62,'#394348','Motor');
    ellipsoid(-0.12,-0.13,0.33,0.36,0.32,0.10,'#69757a','Motor',6,14);
    ellipsoid(-0.12,-0.13,-0.33,0.36,0.32,0.10,'#69757a','Motor',6,14);
    box(-0.10,0.28,0,0.46,0.18,0.50,'#4a555a','Motor');
    for (let i=0;i<5;i++) {
      addLine([-0.36,0.14+i*.055,-0.34],[0.18,0.14+i*.055,-0.34],'#8b969b',3,'Motor');
      addLine([-0.36,0.14+i*.055,0.34],[0.18,0.14+i*.055,0.34],'#8b969b',3,'Motor');
    }
    ellipsoid(-0.30,-0.20,0.38,0.09,0.09,0.03,GREEN,'Óleo do motor',4,10);
    addLine([-0.30,-0.20,0.41],[-0.14,-0.10,0.41],'#d9b64a',3,'Óleo do motor');
    ellipsoid(-0.02,-0.35,0.34,0.06,0.05,0.03,'#b9c2c5','Óleo do motor',4,10);

    // Filtro de ar sob a carenagem
    box(0.38,0.22,0.30,0.42,0.34,0.20,'#1a2226','Filtro de ar');
    box(0.38,0.22,-0.30,0.42,0.34,0.20,'#1a2226','Filtro de ar');
    for (let i=0;i<3;i++) {
      addLine([0.26,0.14+i*.07,0.41],[0.50,0.14+i*.07,0.41],'#4d585d',2,'Filtro de ar');
      addLine([0.26,0.14+i*.07,-0.41],[0.50,0.14+i*.07,-0.41],'#4d585d',2,'Filtro de ar');
    }

    // Tanque, carenagens e selim
    ellipsoid(-0.45,0.55,0,0.68,0.40,0.40,GREEN,'Tanque',8,16);
    ellipsoid(-0.58,0.56,0,0.50,0.32,0.42,GREEN_DARK,'Tanque',6,14);
    box(-0.45,0.91,0,0.20,0.06,0.20,'#1b2327','Tanque');
    ellipsoid(-0.45,0.95,0,0.11,0.04,0.11,SILVER,'Tanque',4,12);
    addDecal([-0.44,0.60,0.41],'mottu','#ffffff',19,'Tanque');
    addFace([[-0.30,0.48,0.44],[0.52,0.46,0.44],[0.42,0.16,0.44],[-0.18,0.14,0.44]],GREEN,'Carenagem lateral');
    addFace([[-0.30,0.48,-0.44],[0.52,0.46,-0.44],[0.42,0.16,-0.44],[-0.18,0.14,-0.44]],GREEN,'Carenagem lateral');
    addFace([[-0.26,0.34,0.445],[0.48,0.32,0.445],[0.45,0.25,0.445],[-0.24,0.27,0.445]],BLACK,'Carenagem lateral');
    addFace([[-0.26,0.34,-0.445],[0.48,0.32,-0.445],[0.45,0.25,-0.445],[-0.24,0.27,-0.445]],BLACK,'Carenagem lateral');
    addDecal([0.10,0.40,0.455],'mottu','#ffffff',17,'Carenagem lateral');
    addDecal([0.10,0.40,-0.455],'mottu','#ffffff',17,'Carenagem lateral');
    box(0.48,0.68,0,0.90,0.15,0.46,BLACK,'Selim');
    ellipsoid(0.10,0.68,0,0.22,0.09,0.23,BLACK,'Selim',5,12);
    box(1.02,0.61,0,0.36,0.10,0.40,BLACK,'Selim');

    // Escapamento no lado visível
    addLine([0.18,-0.24,0.42],[0.55,-0.48,0.48],'#8d979c',11,'Escapamento');
    addLine([0.55,-0.48,0.48],[1.52,-0.40,0.48],BLACK,18,'Escapamento');
    addLine([0.70,-0.46,0.50],[1.42,-0.40,0.50],'#69747a',8,'Escapamento');
    ellipsoid(1.52,-0.40,0.48,0.10,0.09,0.10,'#1a2226','Escapamento',5,12);

    // Farol, guidão, espelhos e painel
    ellipsoid(-1.36,0.76,0,0.18,0.20,0.22,'#3d474b','Farol',6,14);
    ellipsoid(-1.47,0.76,0,0.06,0.16,0.18,'#fff4c2','Farol',5,12);
    box(-1.34,0.98,0,0.26,0.08,0.30,BLACK,'Farol');
    addLine([-1.12,1.03,-0.42],[-1.12,1.03,0.42],'#2b3337',9,'Guidão');
    addLine([-1.12,1.03,-0.42],[-1.12,1.03,-0.53],BLACK,12,'Guidão');
    addLine([-1.12,1.03,0.42],[-1.12,1.03,0.53],BLACK,12,'Guidão');
    addLine([-1.12,1.05,-0.36],[-1.02,1.34,-0.56],'#2b3337',5,'Guidão');
    addLine([-1.12,1.05,0.36],[-1.02,1.34,0.56],'#2b3337',5,'Guidão');
    ellipsoid(-1.00,1.36,-0.58,0.12,0.07,0.04,'#9aa5aa','Guidão',4,10);
    ellipsoid(-1.00,1.36,0.58,0.12,0.07,0.04,'#9aa5aa','Guidão',4,10);
    box(-1.05,0.97,0,0.18,0.13,0.28,'#1a2226','Painel');

    // Lanterna, piscas e placa
    box(1.42,0.52,0,0.18,0.16,0.30,RED,'Lanterna e piscas');
    ellipsoid(1.51,0.52,0,0.05,0.08,0.14,'#ff6b6b','Lanterna e piscas',4,10);
    addLine([1.42,0.58,0.26],[1.62,0.66,0.34],AMBER,6,'Lanterna e piscas');
    addLine([1.42,0.58,-0.26],[1.62,0.66,-0.34],AMBER,6,'Lanterna e piscas');
    ellipsoid(1.62,0.66,0.34,0.08,0.05,0.05,AMBER,'Lanterna e piscas',4,10);
    ellipsoid(1.62,0.66,-0.34,0.08,0.05,0.05,AMBER,'Lanterna e piscas',4,10);
    box(1.48,0.30,0,0.16,0.20,0.30,'#e8ecec','Lanterna e piscas');
  }
  buildModel();

  function init(canvas, onSelect = () => {}) {
    const ctx = canvas.getContext('2d');
    const camera = { yaw: 0, pitch: -0.10, zoom: 1, zoomTarget: 1, targetYaw: 0, focusX: 0, focusY: 0, focusTargetX: 0, focusTargetY: 0 };
    const markerColors = {};
    let width = 1, height = 1, dragging = false, moved = false, lastX = 0, lastY = 0, pinch = 0, projectedMarkers = [], animationFrame = 0, focus = null;
    const pointers = new Map();
    const pinchDistance = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const transform = ([x,y,z]) => {
      const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
      const rx = x*cy + z*sy, rz = -x*sy + z*cy;
      const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
      return [rx, y*cp-rz*sp, y*sp+rz*cp];
    };
    const focusCenter = () => {
      const marker = markers.find(m => m.name === focus);
      return marker ? transform(marker.point) : [0,0];
    };
    const project = point => {
      const [x,y,z] = transform(point);
      const px = x-camera.focusX, py = y-camera.focusY;
      const focal = Math.min(width,height)*1.55*camera.zoom, depth = 5.2-z;
      return { x:width/2+px*focal/depth, y:height*.54-py*focal/depth, z, scale:focal/depth };
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      width = rect.width; height = rect.height;
      if (canvas.width !== Math.round(width*dpr) || canvas.height !== Math.round(height*dpr)) {
        canvas.width = Math.round(width*dpr); canvas.height = Math.round(height*dpr);
        ctx.setTransform(dpr,0,0,dpr,0,0);
      }
    };
    const opacity = part => focus ? (part === focus ? 1 : (sideParts.has(part) ? .10 : .28)) : 1;

    const draw = () => {
      resize();
      if (focus) {
        const center = focusCenter();
        camera.focusTargetX = center[0]; camera.focusTargetY = center[1]; camera.zoomTarget = 1.85;
      } else {
        camera.focusTargetX = 0; camera.focusTargetY = 0; camera.zoomTarget = 1;
      }
      ctx.clearRect(0,0,width,height);
      const ground = project([0,-1.23,0]);
      const gradient = ctx.createRadialGradient(ground.x,ground.y,4,ground.x,ground.y,width*.34);
      gradient.addColorStop(0,'rgba(0,0,0,.55)'); gradient.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=gradient; ctx.beginPath(); ctx.ellipse(ground.x,ground.y,width*.34,height*.075,0,0,TAU); ctx.fill();

      const prepared = faces.map(face => {
        const p = face.points.map(project);
        return { face, p, depth:p.reduce((s,v)=>s+v.z,0)/p.length };
      }).sort((a,b)=>a.depth-b.depth);
      prepared.forEach(({face,p}) => {
        const a=transform(face.points[0]), b=transform(face.points[1]), c=transform(face.points[2]);
        const ux=b[0]-a[0], uy=b[1]-a[1], vx=c[0]-a[0], vy=c[1]-a[1];
        const base = face.part === focus ? shade(face.color, 12) : face.color;
        ctx.globalAlpha = opacity(face.part);
        ctx.fillStyle=shade(base,Math.round(Math.max(-24,Math.min(28,(ux*vy-uy*vx)*18))));
        ctx.beginPath(); ctx.moveTo(p[0].x,p[0].y); p.slice(1).forEach(v=>ctx.lineTo(v.x,v.y)); ctx.closePath(); ctx.fill();
        ctx.strokeStyle=face.part === focus ? 'rgba(255,255,255,.65)' : 'rgba(255,255,255,.035)';
        ctx.lineWidth=face.part === focus ? 1.4 : .7; ctx.stroke();
      });
      ctx.globalAlpha=1;
      lines.map(line => ({...line,a:project(line.a),b:project(line.b)}))
        .sort((a,b)=>(a.a.z+a.b.z)-(b.a.z+b.b.z)).forEach(line => {
          ctx.globalAlpha=opacity(line.part);
          ctx.strokeStyle=line.part === focus ? shade(line.color, 18) : line.color;
          ctx.lineWidth=Math.max(1,line.width*(line.a.scale+line.b.scale)/260); ctx.lineCap='round';
          ctx.beginPath(); ctx.moveTo(line.a.x,line.a.y); ctx.lineTo(line.b.x,line.b.y); ctx.stroke();
        });
      ctx.globalAlpha=1;
      decals.forEach(decal => {
        if (focus && sideParts.has(decal.part) && decal.part !== focus) return;
        const p = project(decal.point), scale = Math.max(.6, Math.min(1.6, p.scale/110));
        ctx.globalAlpha=opacity(decal.part);
        ctx.fillStyle=decal.color; ctx.font=`800 ${decal.size*scale}px system-ui`;
        ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(decal.text,p.x,p.y);
      });
      ctx.globalAlpha=1;

      projectedMarkers = markers.map((m,index) => ({...m,index,...project(m.point)}));
      projectedMarkers.slice().sort((a,b)=>(a.name===focus?1:0)-(b.name===focus?1:0)).forEach(mark => {
        const active = mark.name === focus;
        ctx.globalAlpha=focus && !active ? .42 : 1;
        if (active) {
          ctx.fillStyle='rgba(84,214,145,.20)'; ctx.beginPath(); ctx.arc(mark.x,mark.y,18,0,TAU); ctx.fill();
        }
        ctx.fillStyle=markerColors[mark.name]||'#54d691'; ctx.strokeStyle='#f5fff9'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.arc(mark.x,mark.y,active?11:10,0,TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle='#07120c'; ctx.font='700 10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(String(mark.index+1),mark.x,mark.y+.5);
        if (active) {
          ctx.font='700 11px system-ui'; const label=mark.name, w=ctx.measureText(label).width+14;
          ctx.fillStyle='rgba(7,18,12,.92)'; ctx.fillRect(mark.x-w/2,mark.y-34,w,20);
          ctx.fillStyle='#f5fff9'; ctx.fillText(label,mark.x,mark.y-24);
        }
      });
      ctx.globalAlpha=1;
    };
    const animate = () => {
      const delta = Math.atan2(Math.sin(camera.targetYaw-camera.yaw),Math.cos(camera.targetYaw-camera.yaw));
      const dz = camera.zoomTarget-camera.zoom, dx = camera.focusTargetX-camera.focusX, dy = camera.focusTargetY-camera.focusY;
      if (Math.abs(delta)>.002 || Math.abs(dz)>.004 || Math.abs(dx)>.004 || Math.abs(dy)>.004) {
        camera.yaw += delta*.16; camera.zoom += dz*.16; camera.focusX += dx*.16; camera.focusY += dy*.16;
        draw(); animationFrame=requestAnimationFrame(animate);
      } else {
        camera.yaw=camera.targetYaw; camera.zoom=camera.zoomTarget;
        camera.focusX=camera.focusTargetX; camera.focusY=camera.focusTargetY;
        draw(); animationFrame=0;
      }
    };
    const startAnimation = () => { if(!animationFrame) animationFrame=requestAnimationFrame(animate); };
    const localPoint = event => ({x:event.clientX-canvas.getBoundingClientRect().left,y:event.clientY-canvas.getBoundingClientRect().top});
    canvas.addEventListener('pointerdown', event => {
      pointers.set(event.pointerId, {x:event.clientX,y:event.clientY});
      canvas.setPointerCapture(event.pointerId);
      if (pointers.size === 1) { dragging=true; moved=false; lastX=event.clientX; lastY=event.clientY; }
      else if (pointers.size === 2) { moved=true; pinch=pinchDistance(); }
    });
    canvas.addEventListener('pointermove', event => {
      if(!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, {x:event.clientX,y:event.clientY});
      if (pointers.size >= 2) {
        const d=pinchDistance();
        if(pinch) { camera.zoom=Math.max(.72,Math.min(2.4,camera.zoom*d/pinch)); camera.zoomTarget=camera.zoom; }
        pinch=d; moved=true; draw(); return;
      }
      if(!dragging) return;
      const dx=event.clientX-lastX, dy=event.clientY-lastY; moved ||= Math.abs(dx)+Math.abs(dy)>3;
      camera.yaw += dx*.009; camera.pitch=Math.max(-.42,Math.min(.32,camera.pitch+dy*.006)); camera.targetYaw=camera.yaw;
      if (focus) { const [cx,cy]=focusCenter(); camera.focusX=camera.focusTargetX=cx; camera.focusY=camera.focusTargetY=cy; }
      lastX=event.clientX; lastY=event.clientY; draw();
    });
    const endPointer = (event, cancelled) => {
      const multi = pointers.size >= 2;
      pointers.delete(event.pointerId);
      if (multi) {
        pinch = pointers.size >= 2 ? pinchDistance() : 0;
        dragging = pointers.size === 1;
        if (dragging) { const [only]=[...pointers.values()]; lastX=only.x; lastY=only.y; }
        return;
      }
      dragging=false; pinch=0;
      if(cancelled || moved) return;
      const p=localPoint(event), hit=projectedMarkers.map(m=>({...m,d:Math.hypot(m.x-p.x,m.y-p.y)})).sort((a,b)=>a.d-b.d)[0];
      if(hit?.d<28) onSelect(hit.name === focus ? null : hit.name);
      else if(focus) onSelect(null);
    };
    canvas.addEventListener('pointerup', event => endPointer(event, false));
    canvas.addEventListener('pointercancel', event => endPointer(event, true));
    canvas.addEventListener('wheel', event => { event.preventDefault(); camera.zoom=Math.max(.72,Math.min(2.4,camera.zoom-event.deltaY*.001)); camera.zoomTarget=camera.zoom; draw(); },{passive:false});
    canvas.addEventListener('keydown', event => {
      const step = event.shiftKey ? .3 : .12;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') camera.targetYaw += event.key === 'ArrowLeft' ? -step : step;
      else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') camera.pitch = Math.max(-.42, Math.min(.32, camera.pitch + (event.key === 'ArrowUp' ? -.05 : .05)));
      else if (event.key === 'PageDown' || event.key === 'PageUp') {
        const index = markers.findIndex(marker => marker.name === focus);
        const next = event.key === 'PageDown' ? (index + 1) % markers.length : (index <= 0 ? markers.length - 1 : index - 1);
        onSelect(markers[next].name);
      }
      else if (event.key === '+' || event.key === '=') camera.zoomTarget = Math.min(2.4, camera.zoomTarget + .15);
      else if (event.key === '-' || event.key === '_') camera.zoomTarget = Math.max(.72, camera.zoomTarget - .15);
      else if (event.key === 'Home') onSelect(null);
      else return;
      event.preventDefault(); startAnimation();
    });
    new ResizeObserver(draw).observe(canvas);
    draw();
    return {
      setView(yaw) { focus=null; camera.targetYaw=yaw; camera.zoomTarget=1; camera.focusTargetX=0; camera.focusTargetY=0; startAnimation(); },
      focusPart(name) { focus = markers.some(m=>m.name===name) ? name : null; startAnimation(); },
      getFocus() { return focus; },
      setStatus(name, color) { if (markerColors[name] !== color) { markerColors[name] = color; draw(); } }
    };
  }
  window.Moto3D = { init };
})();
