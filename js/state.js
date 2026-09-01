/* ---------------- State ---------------- */
let courses = [];       // {id,name,credit,target,items:[{name,weight,score}]}
let simAssumed = {};    // courseId -> {itemName: assumedScore}
let courseIdSeq = 1;

const scaleTable = {
  "4.0": [[90,4.0],[85,3.7],[82,3.3],[78,3.0],[75,2.7],[72,2.3],[68,2.0],[66,1.7],[64,1.3],[60,1.0],[0,0]],
  "4.3": [[95,4.3],[90,4.0],[85,3.7],[82,3.3],[78,3.0],[75,2.7],[72,2.3],[68,2.0],[66,1.7],[64,1.3],[62,1.0],[0,0]],
  "5.0": [[95,5.0],[90,4.7],[85,4.3],[82,4.0],[78,3.7],[75,3.3],[72,3.0],[68,2.7],[66,2.3],[64,2.0],[62,1.7],[60,1.0],[0,0]]
};
function scoreToGpa(score, scale){
  const table = scaleTable[scale] || scaleTable["4.0"];
  for(const [min,pt] of table){ if(score>=min) return pt; }
  return 0;
}
