import { AgAllPark, AgAoFoldPark, AgPickoffMirrorPark, AgScienceFoldPark } from '@gql/server/Buttons';

export function AgMechanism({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="top-right">
      <div className="title">
        <span>AG Mechanisms</span>
      </div>
      <div className="ag-body">
        <label className="label" htmlFor="park-science-fold">
          Science Fold
        </label>
        <AgScienceFoldPark id="park-science-fold" disabled={!canEdit} label="Park" data-testid="park-science-fold" />
        <label className="label" htmlFor="park-ao-fold">
          AO Fold
        </label>
        <AgAoFoldPark id="park-ao-fold" disabled={!canEdit} label="Park" data-testid="park-ao-fold" />
        <label className="label" htmlFor="park-ac-pickoff">
          AC Pickoff
        </label>
        <AgPickoffMirrorPark id="park-ac-pickoff" disabled={!canEdit} label="Park" data-testid="park-ac-pickoff" />
        <span></span>
        <AgAllPark id="park-all-ag" disabled={!canEdit} label="Park All" data-testid="park-all-ag" />
      </div>
    </div>
  );
}
